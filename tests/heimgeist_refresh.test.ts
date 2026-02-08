import { Heimgeist, createHeimgeist } from '../src/core/heimgeist';
import { PlannedAction, RiskSeverity, HeimgeistRole } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

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
    (fs.readdirSync as jest.Mock).mockReturnValue([]);

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

  it('should reload actions from disk', () => {
      const actionId = 'action-123';
      const mockAction: PlannedAction = {
          id: actionId,
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
          status: 'pending'
      };

      // 1. Initial state: action not present (or added then modified)
      // Let's simulate that readFileSync returns a modified action
      const updatedAction = { ...mockAction, status: 'approved' };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['action-123.json']);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(updatedAction));

      // 2. Call refreshState
      heimgeist.refreshState();

      // 3. Verify internal state
      const actions = heimgeist.getPlannedActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe(actionId);
      expect(actions[0].status).toBe('approved');
  });

  it('should handle missing directories gracefully', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      expect(() => heimgeist.refreshState()).not.toThrow();
  });

  it('should handle JSON parse errors gracefully', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue(['bad.json']);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');

      // Should not throw, just log warning
      expect(() => heimgeist.refreshState()).not.toThrow();
  });
});
