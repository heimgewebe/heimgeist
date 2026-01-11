import { SelfModel } from './self_model';
import { SystemSignals, SelfModelState } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { SELF_MODEL_DIR } from '../config/state-paths';

// Mock fs to avoid actual file writing during tests
jest.mock('fs');
jest.mock('../config/state-paths', () => ({
  SELF_MODEL_DIR: '/mock/self_model',
}));

describe('SelfModel', () => {
  let selfModel: SelfModel;

  beforeEach(() => {
    jest.resetAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

    // Initialize fresh model
    selfModel = new SelfModel();
  });

  describe('update', () => {
    it('should update fatigue based on cpu load', () => {
      const signals: SystemSignals = { cpu_load: 90 };
      selfModel.update(signals);
      const state = selfModel.getState();
      expect(state.fatigue).toBeGreaterThan(0);
      expect(state.basis_signals).toContain('High CPU load');
    });

    it('should update risk tension based on ci failure rate', () => {
      const signals: SystemSignals = { ci_failure_rate: 0.3 };
      selfModel.update(signals);
      const state = selfModel.getState();
      expect(state.risk_tension).toBeGreaterThan(0);
      expect(state.basis_signals).toContain('High CI failure rate: 0.3');
    });

    it('should lower confidence when error rate is high', () => {
      const signals: SystemSignals = { error_rate: 0.2 };
      selfModel.update(signals);
      const state = selfModel.getState();
      // Confidence starts at 1.0 (minus fatigue/tension).
      // error_rate > 0.1 subtracts 0.3.
      expect(state.confidence).toBeLessThan(1.0);
      expect(state.basis_signals).toContain('High internal error rate: 0.2');
    });
  });

  describe('Autonomy Switching (Hysteresis)', () => {
    it('should switch to critical when risk is high and confidence low', () => {
        // Force state to near critical
        const signals: SystemSignals = {
            risk_score: 0.7, // High tension
            error_rate: 0.5  // Lowers confidence significantly
        };
        selfModel.update(signals);

        const state = selfModel.getState();
        expect(state.risk_tension).toBeGreaterThan(0.6);
        expect(state.confidence).toBeLessThan(0.5);
        expect(state.autonomy_level).toBe('critical');
    });

    it('should NOT switch back from critical immediately (hysteresis)', () => {
        // First get to critical
        let signals: SystemSignals = { risk_score: 0.8, error_rate: 0.5 };
        selfModel.update(signals);
        expect(selfModel.getState().autonomy_level).toBe('critical');

        // Now improve conditions slightly, but not enough to exit critical
        // Recovery requires risk < 0.4 and confidence > 0.6
        signals = { risk_score: 0.5, error_rate: 0.0 }; // Risk 0.5 is still >= 0.4
        selfModel.update(signals);

        expect(selfModel.getState().autonomy_level).toBe('critical');
    });

    it('should switch back from critical when conditions are very good', () => {
        // First get to critical
        let signals: SystemSignals = { risk_score: 0.8, error_rate: 0.5 };
        selfModel.update(signals);
        expect(selfModel.getState().autonomy_level).toBe('critical');

        // Now improve conditions significantly
        // Recovery requires risk < 0.4 and confidence > 0.6
        signals = { risk_score: 0.1, error_rate: 0.0 };
        selfModel.update(signals);

        const state = selfModel.getState();
        expect(state.autonomy_level).toBe('reflective'); // As per logic: critical -> reflective
    });
  });

  describe('reflect', () => {
      it('should increase confidence on success', () => {
          // Establish baseline with some fatigue/risk so confidence isn't maxed out (1.0)
          selfModel.update({ cpu_load: 85 });
          const startConfidence = selfModel.getState().confidence;
          // Ensure we start below 1.0
          expect(startConfidence).toBeLessThan(1.0);

          selfModel.reflect(true);
          expect(selfModel.getState().confidence).toBeGreaterThan(startConfidence);
      });

      it('should decrease confidence on failure', () => {
          selfModel.update({ cpu_load: 50 });
          const startConfidence = selfModel.getState().confidence;

          selfModel.reflect(false);
          expect(selfModel.getState().confidence).toBeLessThan(startConfidence);
      });
  });

  describe('Safety Gate', () => {
      it('should return safe when metrics are good', () => {
          selfModel.update({}); // Defaults to good
          expect(selfModel.checkSafetyGate().safe).toBe(true);
      });

      it('should block when fatigue is high', () => {
          selfModel.update({ cpu_load: 90, memory_pressure: 90, open_actions_count: 20 });
          // Fatigue should be ~0.8
          expect(selfModel.checkSafetyGate().safe).toBe(false);
          expect(selfModel.checkSafetyGate().reason).toContain('Fatigue');
      });
  });
});
