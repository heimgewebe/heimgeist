import * as fs from 'fs';
import * as path from 'path';
import { SelfStateBundle, SelfModelState, SelfStateSnapshot } from '../types';

/**
 * Responsible for writing the Self-State Artifact Bundle
 * Atomic writes, retention awareness.
 */
export class ArtifactWriter {
  private dirPath: string;

  constructor(dirPath: string) {
    this.dirPath = dirPath;
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.dirPath)) {
      try {
        fs.mkdirSync(this.dirPath, { recursive: true });
      } catch (e) {
        console.error(`Failed to create artifacts dir: ${e}`);
      }
    }
  }

  /**
   * Write the self-state bundle to disk
   * Atomic operation: write to tmp, then rename.
   */
  public write(current: SelfModelState, history: SelfStateSnapshot[]): void {
    if (!fs.existsSync(this.dirPath)) return;

    // Constrain history size for the artifact (last 50 entries)
    // History is expected to be newest-first, so slice(0, 50) keeps the latest.
    const limitedHistory = history.slice(0, 50);

    // CONTRACT: Schema MUST be 'heimgeist.self_state.bundle.v1'
    // History MUST be array of { timestamp, state } objects (SelfStateSnapshot)
    const bundle: SelfStateBundle = {
      schema: 'heimgeist.self_state.bundle.v1',
      current: this.sanitizeSelfState(current),
      history: limitedHistory.map(snapshot => ({
        timestamp: snapshot.timestamp,
        state: this.sanitizeSelfState(snapshot.state)
      }))
    };

    const filename = 'self_state.json';
    const filepath = path.join(this.dirPath, filename);
    const tmpFilepath = path.join(this.dirPath, `${filename}.tmp`);

    try {
      fs.writeFileSync(tmpFilepath, JSON.stringify(bundle, null, 2));

      // Robust atomic replace: unlink target if exists to handle cross-device/windows issues safer
      if (fs.existsSync(filepath)) {
          try {
              fs.unlinkSync(filepath);
          } catch {
              // If unlink fails, rename might still work (or fail), proceed to try rename
          }
      }
      fs.renameSync(tmpFilepath, filepath);
    } catch (e) {
      console.error(`Failed to write artifact bundle: ${e}`);
    } finally {
      // Ensure cleanup of tmp file if it still exists (e.g. rename failed)
      try {
        if (fs.existsSync(tmpFilepath)) fs.unlinkSync(tmpFilepath);
      } catch { /* ignore cleanup error */ }
    }
  }

  /**
   * Sanitize state to ensure strict adherence to SelfModelState contract
   * Drops any internal/debug fields that might have leaked into the object.
   */
  private sanitizeSelfState(state: SelfModelState): SelfModelState {
    return {
      confidence: state.confidence,
      fatigue: state.fatigue,
      risk_tension: state.risk_tension,
      autonomy_level: state.autonomy_level,
      last_updated: state.last_updated,
      basis_signals: Array.isArray(state.basis_signals) ? [...state.basis_signals] : []
    };
  }
}
