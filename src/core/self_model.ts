import { SelfModelState, SystemSignals, SelfStateSnapshot } from '../types';
import { SelfStateStore } from './self_state_store';

export class SelfModel {
  private state: SelfModelState;
  private store: SelfStateStore;
  private lastPersistedState?: SelfModelState; // Object snapshot for delta comparison

  // Thresholds for heuristics
  private readonly FATIGUE_THRESHOLD = 0.75;
  private readonly CONFIDENCE_THRESHOLD = 0.35;
  private readonly RISK_TENSION_THRESHOLD = 0.6;
  private readonly MAX_BASIS_SIGNALS = 50;

  constructor(initialState?: SelfModelState) {
    this.store = new SelfStateStore();

    // Try to load from persistence if no initial state provided
    const loadedState = this.store.loadLatest();

    this.state = initialState || loadedState || {
      confidence: 1.0,
      fatigue: 0.0,
      risk_tension: 0.0,
      autonomy_level: 'dormant', // Start dormant until first update or config
      last_updated: new Date().toISOString(),
      basis_signals: []
    };
  }

  /**
   * Get the current state (read-only copy)
   */
  public getState(): SelfModelState {
    return { ...this.state };
  }

  /**
   * Get history of states
   */
  public getHistory(limit: number = 50): SelfStateSnapshot[] {
    return this.store.getHistory(limit);
  }

  /**
   * Update the self-model based on system signals
   * Returns true if state was persisted (changed significantly or timeout), false otherwise.
   * Implements: "Initiale Ableitung (heuristisch, explizit): CI-Fehlerquote, Anzahl offener Actions..."
   */
  public update(signals: SystemSignals): boolean {
    const basis_signals: string[] = [];

    // Preserve manual signals
    if (this.state.basis_signals && Array.isArray(this.state.basis_signals)) {
      const manualSignals = this.state.basis_signals.filter((s) => s.startsWith('Manual'));
      basis_signals.push(...manualSignals);
    }

    // 1. Calculate Fatigue
    // Heuristic: High CPU/Memory or many open actions causes fatigue
    let fatigue = 0.0;
    if (typeof signals.cpu_load === 'number' && signals.cpu_load > 80) {
        fatigue += 0.3;
        basis_signals.push('High CPU load');
    }
    if (typeof signals.memory_pressure === 'number' && signals.memory_pressure > 80) {
        fatigue += 0.3;
        basis_signals.push('High memory pressure');
    }
    if (typeof signals.open_actions_count === 'number' && signals.open_actions_count > 10) {
        fatigue += 0.2;
        basis_signals.push(`Open actions backlog: ${signals.open_actions_count}`);
    }
    this.state.fatigue = Math.min(1.0, Math.max(0.0, fatigue));

    // 2. Calculate Risk Tension
    // Heuristic: CI failures, Conflicts, external Risk Score
    let riskTension = 0.0;
    if (typeof signals.risk_score === 'number') {
        riskTension = signals.risk_score; // Direct mapping if available
    } else {
        // Fallback calculation
        if (typeof signals.ci_failure_rate === 'number' && signals.ci_failure_rate > 0.2) {
            riskTension += 0.4;
            basis_signals.push(`High CI failure rate: ${signals.ci_failure_rate}`);
        }
        if (typeof signals.conflicts_count === 'number' && signals.conflicts_count > 0) {
            riskTension += 0.3;
            basis_signals.push('Unresolved conflicts detected');
        }
    }
    this.state.risk_tension = Math.min(1.0, Math.max(0.0, riskTension));

    // 3. Calculate Confidence
    // Heuristic: Inverse of fatigue and tension? Or strictly success rate?
    // For now: Start high, decrease by fatigue and tension factors
    // "Regel: hohe risk_tension + niedrige confidence ⇒ Wechsel zu critical"
    let confidence = 1.0 - (this.state.fatigue * 0.4) - (this.state.risk_tension * 0.4);

    // If error rate is high, confidence drops drastically
    if (typeof signals.error_rate === 'number' && signals.error_rate > 0.1) {
        confidence -= 0.3;
        basis_signals.push(`High internal error rate: ${signals.error_rate}`);
    }

    this.state.confidence = Math.min(1.0, Math.max(0.0, confidence));

    this.state.basis_signals = basis_signals;
    this.state.last_updated = new Date().toISOString();

    // 4. Update Autonomy Level with Hysteresis
    this.updateAutonomyLevel();

    // Persist with Throttling (Delta-based)
    // Persist only if:
    // - Autonomy Level changes
    // - |Delta confidence| >= 0.05
    // - |Delta risk_tension| >= 0.1
    // - First run (no lastPersistedState)

    let shouldPersist = false;

    if (!this.lastPersistedState) {
        shouldPersist = true;
    } else {
        const deltaConfidence = Math.abs(this.state.confidence - this.lastPersistedState.confidence);
        const deltaRisk = Math.abs(this.state.risk_tension - this.lastPersistedState.risk_tension);
        const autonomyChanged = this.state.autonomy_level !== this.lastPersistedState.autonomy_level;

        if (autonomyChanged || deltaConfidence >= 0.05 || deltaRisk >= 0.1) {
            shouldPersist = true;
        }
    }

    if (shouldPersist) {
        this.store.save(this.state);
        // Deep copy state for next comparison
        this.lastPersistedState = JSON.parse(JSON.stringify(this.state));
        return true;
    }

    return false;
  }

  /**
   * Determine autonomy level based on internal state
   * "Regel: hohe risk_tension + niedrige confidence ⇒ Wechsel zu critical"
   * "Hysterese verpflichtend (kein Flip-Flop)"
   */
  private updateAutonomyLevel(): void {
    const current = this.state.autonomy_level;
    let next = current;

    // Critical Condition
    // high risk_tension (>0.6) + low confidence (<0.5)
    if (this.state.risk_tension > 0.6 && this.state.confidence < 0.5) {
        next = 'critical';
    }
    // Recovery from Critical -> Reflective
    // Needs significantly lower risk to switch back (Hysteresis)
    else if (current === 'critical') {
        if (this.state.risk_tension < 0.4 && this.state.confidence > 0.6) {
            next = 'reflective';
        }
    }
    // Normal transitions
    else if (this.state.fatigue > 0.7) {
        // Too tired to be fully operative/aware? Maybe reflective?
        next = 'reflective'; // "Sit back and think"
    }
    else if (this.state.confidence > 0.8 && this.state.risk_tension < 0.3) {
      // Only promote to aware if we are not dormant (requires manual wake-up)
      if (current !== 'dormant') {
        next = 'aware'; // "Alert and ready"
      }
    }
    // Default fallback if not dormant
    else if (current !== 'dormant') {
       // Maintain current unless conditions force change
       // If undefined state, default to aware
       if (!['critical', 'reflective', 'aware'].includes(current)) {
           next = 'aware';
       }
    }

    if (next !== current) {
        this.state.autonomy_level = next;
    }
  }

  /**
   * Reflect on action outcomes to adjust self-model
   * "nach Aktion: self_model.reflect(outcome)"
   */
  public reflect(success: boolean): void {
      if (success) {
          // Success boosts confidence slightly, reduces fatigue slightly?
          this.state.confidence = Math.min(1.0, this.state.confidence + 0.05);
      } else {
          // Failure hurts confidence
          this.state.confidence = Math.max(0.0, this.state.confidence - 0.1);
          // And increases tension
          this.state.risk_tension = Math.min(1.0, this.state.risk_tension + 0.05);
      }
      this.state.last_updated = new Date().toISOString();
      this.updateAutonomyLevel();
      this.store.save(this.state);
  }

  /**
   * Helper to safely add a basis signal with bounds
   */
  private addBasisSignal(msg: string): void {
      if (!Array.isArray(this.state.basis_signals)) {
          this.state.basis_signals = [];
      }
      this.state.basis_signals.push(msg);

      // Limit growth
      if (this.state.basis_signals.length > this.MAX_BASIS_SIGNALS) {
          this.state.basis_signals = this.state.basis_signals.slice(-this.MAX_BASIS_SIGNALS);
      }
  }

  /**
   * Manual override or command-based reset
   */
  public reset(): void {
      this.state = {
        confidence: 1.0,
        fatigue: 0.0,
        risk_tension: 0.0,
        autonomy_level: 'aware',
        last_updated: new Date().toISOString(),
        basis_signals: []
      };
      this.addBasisSignal('Manual Reset');
      this.store.save(this.state);
  }

  /**
   * Manual set
   */
  public setAutonomy(level: 'dormant' | 'aware' | 'reflective' | 'critical'): void {
      this.state.autonomy_level = level;
      this.addBasisSignal(`Manual override to ${level}`);
      this.state.last_updated = new Date().toISOString();
      this.store.save(this.state);
  }

  /**
   * Safety Gate Checks
   * "Kein selbstmodifizierender Vorschlag bei: fatigue > 0.75, confidence < 0.35, risk_tension > 0.6"
   */
  public checkSafetyGate(): { safe: boolean; reason?: string } {
      if (this.state.fatigue > this.FATIGUE_THRESHOLD) {
          return { safe: false, reason: `Fatigue too high (${this.state.fatigue.toFixed(2)})` };
      }
      if (this.state.confidence < this.CONFIDENCE_THRESHOLD) {
          return { safe: false, reason: `Confidence too low (${this.state.confidence.toFixed(2)})` };
      }
      if (this.state.risk_tension > this.RISK_TENSION_THRESHOLD) {
          return { safe: false, reason: `Risk tension too high (${this.state.risk_tension.toFixed(2)})` };
      }
      return { safe: true };
  }
}
