import { Heimgeist, createHeimgeist } from './heimgeist';
import { AutonomyLevel, HeimgeistRole, EventType, ChronikEvent } from '../types';
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
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
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
    (fs.promises.writeFile as jest.Mock).mockClear();

    const actions = heimgeist.getPlannedActions();
    if (actions.length > 0) {
        const actionId = actions[0].id;

        // 2. Approve the action
        const success = heimgeist.approveAction(actionId);
        expect(success).toBe(true);

        // Await any pending promises (saveAction is now properly asynchronous but approveAction doesn't await it so we tick macro task queue)
        await new Promise((resolve) => setTimeout(resolve, 0));

        // 3. Verify that saveAction (and thus fs.promises.writeFile) was called
        expect(fs.promises.writeFile).toHaveBeenCalled();

        // Verify the content being written has status 'approved'
        const writeCalls = (fs.promises.writeFile as jest.Mock).mock.calls;
        const actionWrite = writeCalls.find((call: unknown[]) =>
            typeof call[0] === 'string' && call[0].includes(actionId)
        );
        expect(actionWrite).toBeDefined();
        if (actionWrite) {
            const savedAction = JSON.parse(actionWrite[1] as string);
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
    (fs.promises.writeFile as jest.Mock).mockClear();

    const actions = heimgeist.getPlannedActions();
    if (actions.length > 0) {
        const actionId = actions[0].id;

        // 2. Reject the action
        const success = heimgeist.rejectAction(actionId);
        expect(success).toBe(true);

        // Await any pending promises (saveAction is now properly asynchronous but rejectAction doesn't await it so we tick macro task queue)
        await new Promise((resolve) => setTimeout(resolve, 0));

        // 3. Verify persistence
        expect(fs.promises.writeFile).toHaveBeenCalled();

        const writeCalls = (fs.promises.writeFile as jest.Mock).mock.calls;
        const actionWrite = writeCalls.find((call: unknown[]) =>
            typeof call[0] === 'string' && call[0].includes(actionId)
        );
        expect(actionWrite).toBeDefined();
        if (actionWrite) {
            const savedAction = JSON.parse(actionWrite[1] as string);
            expect(savedAction.status).toBe('rejected');
        }
    }
  });
});
