import { Heimgeist, createHeimgeist } from './heimgeist';
import { AutonomyLevel, HeimgeistRole, RiskSeverity, EventType, ChronikEvent } from '../types';
import * as fs from 'fs';
import { Logger } from './logger';

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  readFileSync: jest.fn(),
}));

class MockLogger implements Logger {
  log = jest.fn();
  warn = jest.fn();
  error = jest.fn();
}

describe('Heimgeist Persistence', () => {
  let heimgeist: Heimgeist;
  let mockLogger: MockLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = new MockLogger();
    heimgeist = createHeimgeist({
        autonomyLevel: AutonomyLevel.Warning,
        activeRoles: [
          HeimgeistRole.Observer,
          HeimgeistRole.Critic,
          HeimgeistRole.Director,
          HeimgeistRole.Archivist,
        ],
        policies: [],
        eventSources: [],
        outputs: [],
        persistenceEnabled: true,
    }, mockLogger);
  });

  it('should persist action when approved', async () => {
    // 1. Create a planned action (simulated via processEvent)
    const event: ChronikEvent = {
        id: 'test-event-critical',
        type: EventType.IncidentDetected,
        timestamp: new Date(),
        source: 'monitoring',
        payload: { description: 'Critical system failure' },
    };

    // This will plan an action
    await heimgeist.processEvent(event);

    // Clear mocks from the initial processing
    (fs.writeFileSync as jest.Mock).mockClear();

    const actions = heimgeist.getPlannedActions();
    if (actions.length > 0) {
        const actionId = actions[0].id;

        // 2. Approve the action
        const success = heimgeist.approveAction(actionId);
        expect(success).toBe(true);

        // 3. Verify that saveAction (and thus fs.writeFileSync) was called
        expect(fs.writeFileSync).toHaveBeenCalled();

        // Verify the content being written has status 'approved'
        const writeCalls = (fs.writeFileSync as jest.Mock).mock.calls;
        const actionWrite = writeCalls.find((call: any[]) => call[0].includes(actionId));
        expect(actionWrite).toBeDefined();
        if (actionWrite) {
            const savedAction = JSON.parse(actionWrite[1]);
            expect(savedAction.status).toBe('approved');
        }
    }
  });

  it('should persist action when rejected', async () => {
    // 1. Create a planned action
    const event: ChronikEvent = {
        id: 'test-event-critical-2',
        type: EventType.IncidentDetected,
        timestamp: new Date(),
        source: 'monitoring',
        payload: { description: 'Critical system failure' },
    };

    await heimgeist.processEvent(event);
    (fs.writeFileSync as jest.Mock).mockClear();

    const actions = heimgeist.getPlannedActions();
    if (actions.length > 0) {
        const actionId = actions[0].id;

        // 2. Reject the action
        const success = heimgeist.rejectAction(actionId);
        expect(success).toBe(true);

        // 3. Verify persistence
        expect(fs.writeFileSync).toHaveBeenCalled();

        const writeCalls = (fs.writeFileSync as jest.Mock).mock.calls;
        const actionWrite = writeCalls.find((call: any[]) => call[0].includes(actionId));
        expect(actionWrite).toBeDefined();
        if (actionWrite) {
            const savedAction = JSON.parse(actionWrite[1]);
            expect(savedAction.status).toBe('rejected');
        }
    }
  });
});
