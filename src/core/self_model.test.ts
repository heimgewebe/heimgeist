import { SelfModel } from './self_model';
import { SystemSignals } from '../types';
import * as fs from 'fs';

// Mock fs to avoid actual file writing during tests
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
  }
}));

jest.mock('../config/state-paths', () => ({
  SELF_MODEL_DIR: '/mock/self_model',
}));

describe('SelfModel', () => {
  let selfModel: SelfModel;

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (fs.readdirSync as jest.Mock).mockReturnValue([]); // For loadLatest

    // Initialize fresh model
    selfModel = new SelfModel();
  });

  describe('update', () => {
    it('should update fatigue based on cpu load', async () => {
      const signals: SystemSignals = { cpu_load: 90 };
      await selfModel.update(signals);
      const state = selfModel.getState();
      expect(state.fatigue).toBeGreaterThan(0);
      expect(state.basis_signals).toContain('High CPU load');
    });

    it('should update risk tension based on ci failure rate', async () => {
      const signals: SystemSignals = { ci_failure_rate: 0.3 };
      await selfModel.update(signals);
      const state = selfModel.getState();
      expect(state.risk_tension).toBeGreaterThan(0);
      expect(state.basis_signals).toContain('High CI failure rate: 0.3');
    });

    it('should lower confidence when error rate is high', async () => {
      const signals: SystemSignals = { error_rate: 0.2 };
      await selfModel.update(signals);
      const state = selfModel.getState();
      // Confidence starts at 1.0 (minus fatigue/tension).
      // error_rate > 0.1 subtracts 0.3.
      expect(state.confidence).toBeLessThan(1.0);
      expect(state.basis_signals).toContain('High internal error rate: 0.2');
    });
  });

  describe('Autonomy Switching (Hysteresis)', () => {
    it('should switch to critical when risk is high and confidence low', async () => {
        // Force state to near critical
        const signals: SystemSignals = {
            risk_score: 0.7, // High tension
            error_rate: 0.5  // Lowers confidence significantly
        };
        await selfModel.update(signals);

        const state = selfModel.getState();
        expect(state.risk_tension).toBeGreaterThan(0.6);
        expect(state.confidence).toBeLessThan(0.5);
        expect(state.autonomy_level).toBe('critical');
    });

    it('should NOT switch back from critical immediately (hysteresis)', async () => {
        // First get to critical
        let signals: SystemSignals = { risk_score: 0.8, error_rate: 0.5 };
        await selfModel.update(signals);
        expect(selfModel.getState().autonomy_level).toBe('critical');

        // Now improve conditions slightly, but not enough to exit critical
        // Recovery requires risk < 0.4 and confidence > 0.6
        signals = { risk_score: 0.5, error_rate: 0.0 }; // Risk 0.5 is still >= 0.4
        await selfModel.update(signals);

        expect(selfModel.getState().autonomy_level).toBe('critical');
    });

    it('should switch back from critical when conditions are very good', async () => {
        // First get to critical
        let signals: SystemSignals = { risk_score: 0.8, error_rate: 0.5 };
        await selfModel.update(signals);
        expect(selfModel.getState().autonomy_level).toBe('critical');

        // Now improve conditions significantly
        // Recovery requires risk < 0.4 and confidence > 0.6
        signals = { risk_score: 0.1, error_rate: 0.0 };
        await selfModel.update(signals);

        const state = selfModel.getState();
        expect(state.autonomy_level).toBe('reflective'); // As per logic: critical -> reflective
    });
  });

  describe('reflect', () => {
      it('should increase confidence on success', async () => {
          // Establish baseline with some fatigue/risk so confidence isn't maxed out (1.0)
          await selfModel.update({ cpu_load: 85 });
          const startConfidence = selfModel.getState().confidence;
          // Ensure we start below 1.0
          expect(startConfidence).toBeLessThan(1.0);

          await selfModel.reflect(true);
          expect(selfModel.getState().confidence).toBeGreaterThan(startConfidence);
      });

      it('should decrease confidence on failure', async () => {
          await selfModel.update({ cpu_load: 50 });
          const startConfidence = selfModel.getState().confidence;

          await selfModel.reflect(false);
          expect(selfModel.getState().confidence).toBeLessThan(startConfidence);
      });
  });

  describe('Safety Gate', () => {
      it('should return safe when metrics are good', async () => {
          await selfModel.update({}); // Defaults to good
          expect(selfModel.checkSafetyGate().safe).toBe(true);
      });

      it('should block when fatigue is high', async () => {
          await selfModel.update({ cpu_load: 90, memory_pressure: 90, open_actions_count: 20 });
          // Fatigue should be ~0.8
          expect(selfModel.checkSafetyGate().safe).toBe(false);
          expect(selfModel.checkSafetyGate().reason).toContain('Fatigue');
      });
  });
});
