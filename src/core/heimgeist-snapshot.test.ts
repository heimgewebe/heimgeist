import { Heimgeist } from './heimgeist';
import {
  ChronikClient,
  SystemSignals,
  HeimgeistSelfStateSnapshotEvent,
  HeimgeistRole,
} from '../types';
import { defaultLogger } from './logger';
import { createHeimgeist } from './heimgeist';
import * as fs from 'fs';

// Mock dependencies
jest.mock('fs');
jest.mock('./logger');

describe('Heimgeist Snapshot Events', () => {
  let heimgeist: Heimgeist;
  let mockChronik: jest.Mocked<ChronikClient>;

  beforeEach(() => {
    jest.resetAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

    mockChronik = {
      nextEvent: jest.fn().mockResolvedValue(null),
      append: jest.fn().mockResolvedValue(undefined),
    };

    heimgeist = createHeimgeist(
      {
        autonomyLevel: 2,
        activeRoles: [
          HeimgeistRole.Observer,
          HeimgeistRole.Critic,
          HeimgeistRole.Director,
          HeimgeistRole.Archivist,
        ],
        policies: [],
        eventSources: [],
        outputs: [],
        persistenceEnabled: false,
      },
      defaultLogger,
      mockChronik
    );
  });

  it('should publish a snapshot event when updating self model', async () => {
    const signals: SystemSignals = { cpu_load: 90 };
    await heimgeist.updateSelfModel(signals);

    // Wait for async operations (publishSelfStateSnapshot is void promise)
    await new Promise(process.nextTick);

    expect(mockChronik.append).toHaveBeenCalledTimes(1);

    const event = mockChronik.append.mock.calls[0][0] as HeimgeistSelfStateSnapshotEvent;
    expect(event.kind).toBe('heimgeist.self_state.snapshot');
    expect(event.version).toBe(1);
    expect(event.meta.occurred_at).toBeDefined();
    expect(event.data.confidence).toBeDefined();
    expect(event.data.basis_signals).toContain('High CPU load');
    expect(typeof event.data.confidence).toBe('number');
  });

  it('should publish a snapshot event after executing an action (reflection)', async () => {
    // Manually inject an action to test execution reflection
    const actionId = 'test-action-1';
    const mockAction = {
      id: actionId,
      timestamp: new Date(),
      trigger: { id: 't1', title: 'test' } as unknown as import('../types').Insight,
      steps: [],
      requiresConfirmation: false,
      status: 'approved' as const,
    };

    // Inject into private map
    (heimgeist as unknown as { plannedActions: Map<string, unknown> }).plannedActions.set(
      actionId,
      mockAction
    );

    // Reset mock before execution
    mockChronik.append.mockClear();

    // Execute
    await heimgeist.executeAction(actionId);

    // Wait for async
    await new Promise(process.nextTick);

    expect(mockChronik.append).toHaveBeenCalledTimes(1);
    const event = mockChronik.append.mock.calls[0][0] as HeimgeistSelfStateSnapshotEvent;
    expect(event.kind).toBe('heimgeist.self_state.snapshot');
  });
});
