import { Heimgeist, createHeimgeist } from '../src/core/heimgeist';
import { PlannedAction, RiskSeverity, HeimgeistRole } from '../src/types';
import * as fs from 'fs';
import { ACTIONS_DIR, INSIGHTS_DIR } from '../src/config/state-paths';

// Mock fs and config
jest.mock('fs');
jest.mock('../src/config/state-paths', () => ({
  ACTIONS_DIR: '/mock/actions',
  INSIGHTS_DIR: '/mock/insights',
  ARTIFACTS_DIR: '/mock/artifacts',
  STATE_DIR: '/mock/state',
}));

describe('Heimgeist.refreshState', () => {
  let heimgeist: Heimgeist;

  beforeEach(() => {
    jest.resetAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    // Default empty directory listings
    (fs.readdirSync as jest.Mock).mockImplementation((p: string) => []);
    // Default empty object for files (valid JSON) to avoid parse errors
    (fs.readFileSync as jest.Mock).mockReturnValue('{}');

    // Create instance (will call loadState -> refreshState)
    heimgeist = createHeimgeist({
        autonomyLevel: 2,
        activeRoles: [HeimgeistRole.Director],
        policies: [],
        eventSources: [],
        outputs: [],
        persistenceEnabled: true
    });
  });

  const createMockAction = (id: string, status: PlannedAction['status'] = 'pending'): PlannedAction => ({
      id,
      timestamp: new Date(),
      trigger: {
          id: 'trigger-1',
          timestamp: new Date(),
          role: HeimgeistRole.Critic,
          type: 'risk',
          severity: RiskSeverity.Medium,
          title: 'Test Risk',
          description: 'Test'
      },
      steps: [],
      requiresConfirmation: true,
      status
  });

  it('should reload actions from disk (Disk as Source-of-Truth)', () => {
      const actionId = 'action-123';
      const mockAction = createMockAction(actionId, 'approved');

      (fs.existsSync as jest.Mock).mockReturnValue(true);

      // Mock readdir to return our file when querying ACTIONS_DIR
      (fs.readdirSync as jest.Mock).mockImplementation((p: string) => {
          if (p === ACTIONS_DIR) return ['action-123.json'];
          if (p === INSIGHTS_DIR) return [];
          return [];
      });

      // Mock readFile to return the content
      (fs.readFileSync as jest.Mock).mockImplementation((p: string) => {
          if (p.includes(actionId)) return JSON.stringify(mockAction);
          return '{}';
      });

      // 2. Call refreshState
      heimgeist.refreshState();

      // 3. Verify internal state
      const actions = heimgeist.getPlannedActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe(actionId);
      expect(actions[0].status).toBe('approved');
  });

  it('should remove actions that are deleted from disk', () => {
      // 1. Setup initial state with an action
      const actionId = 'action-todelete';
      const mockAction = createMockAction(actionId);

      // Setup mocks for initial load
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockImplementation((p: string) => {
          if (p === ACTIONS_DIR) return [`${actionId}.json`];
          return [];
      });
      (fs.readFileSync as jest.Mock).mockImplementation((p: string) => {
          if (p.includes(actionId)) return JSON.stringify(mockAction);
          return '{}';
      });

      heimgeist.refreshState();
      expect(heimgeist.getPlannedActions()).toHaveLength(1);

      // 2. Simulate file deletion (empty directory)
      (fs.readdirSync as jest.Mock).mockImplementation((p: string) => {
          if (p === ACTIONS_DIR) return []; // Empty!
          return [];
      });

      // 3. Refresh again
      heimgeist.refreshState();

      // 4. Verify action is gone
      expect(heimgeist.getPlannedActions()).toHaveLength(0);
  });

  it('should handle missing directories gracefully', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => heimgeist.refreshState()).not.toThrow();
  });

  it('should handle JSON parse errors gracefully and skip invalid files', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockImplementation((p: string) => {
          if (p === ACTIONS_DIR) return ['bad.json'];
          return [];
      });
      (fs.readFileSync as jest.Mock).mockImplementation((p: string) => {
          if (p.includes('bad.json')) return 'invalid json';
          return '{}';
      });

      // Should not throw, just log warning
      expect(() => heimgeist.refreshState()).not.toThrow();

      // Should result in empty state (invalid file skipped)
      expect(heimgeist.getPlannedActions()).toHaveLength(0);
  });
});
