import { Heimgeist, createHeimgeist } from './heimgeist';
import { EventType, RiskSeverity, HeimgeistRole, AutonomyLevel } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { defaultLogger } from './logger';
import * as fs from 'fs';

// Mock fs to avoid writing to disk during tests
jest.mock('fs');
jest.mock('timers/promises', () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined),
}));

describe('Heimgeist Critical Flows', () => {
  let heimgeist: Heimgeist;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);

    // Create fresh instance with explicit config to avoid loading from disk
    heimgeist = createHeimgeist({
        autonomyLevel: AutonomyLevel.Warning, // Level 2
        activeRoles: [HeimgeistRole.Observer, HeimgeistRole.Critic, HeimgeistRole.Director, HeimgeistRole.Archivist],
        policies: [],
        eventSources: [],
        outputs: [],
        persistenceEnabled: false // Important for tests
    }, defaultLogger);
  });

  test('should escalate CI failure on main to CRITICAL and propose wgx-guard', async () => {
    const event = {
      id: uuidv4(),
      type: EventType.CIResult,
      timestamp: new Date(),
      source: 'github-actions',
      payload: {
        status: 'failed',
        branch: 'main',
        repo: 'test-repo',
        pipeline_id: '123'
      }
    };

    const insights = await heimgeist.processEvent(event);

    // 1. Verify Insight
    const riskInsight = insights.find(i => i.type === 'risk');
    expect(riskInsight).toBeDefined();
    expect(riskInsight?.severity).toBe(RiskSeverity.Critical);
    expect(riskInsight?.title).toBe('Critical CI Failure on Main');
    expect(riskInsight?.description).toContain('main branch');

    // 2. Verify Action
    const actions = heimgeist.getPlannedActions();
    const criticalAction = actions.find(a => a.trigger.id === riskInsight?.id);
    expect(criticalAction).toBeDefined();

    // Check steps order
    expect(criticalAction?.steps[0].tool).toBe('wgx-guard');
    expect(criticalAction?.steps[1].tool).toBe('sichter-quick');
  });

  test('should treat CI failure on other branches as MEDIUM', async () => {
    const event = {
      id: uuidv4(),
      type: EventType.CIResult,
      timestamp: new Date(),
      source: 'github-actions',
      payload: {
        status: 'failed',
        branch: 'feature/123',
        repo: 'test-repo',
        pipeline_id: '124'
      }
    };

    const insights = await heimgeist.processEvent(event);

    const riskInsight = insights.find(i => i.type === 'risk');
    expect(riskInsight).toBeDefined();
    expect(riskInsight?.severity).toBe(RiskSeverity.Medium);
    expect(riskInsight?.title).toBe('CI Build Failed');
  });
});
