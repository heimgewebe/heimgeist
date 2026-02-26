import * as fs from 'fs';
import * as path from 'path';
import { SELF_MODEL_DIR } from '../config/state-paths';
import { SelfStateSnapshot, SelfModelState } from '../types';

/**
 * Persists and retrieves Self-Model snapshots
 */
export class SelfStateStore {
  constructor() {
    this.ensureDir();
  }

  private ensureDir(): void {
    if (!fs.existsSync(SELF_MODEL_DIR)) {
      fs.mkdirSync(SELF_MODEL_DIR, { recursive: true });
    }
  }

  /**
   * Save a snapshot of the self-model
   */
  public async save(state: SelfModelState): Promise<void> {
    const timestamp = new Date().toISOString();
    const snapshot: SelfStateSnapshot = {
      timestamp,
      state: { ...state } // defensive copy
    };

    // Use timestamp in filename for easy sorting
    // Sanitize timestamp for filename (replace colons)
    const filename = `snapshot-${timestamp.replace(/:/g, '-')}.json`;
    const filepath = path.join(SELF_MODEL_DIR, filename);

    try {
      await fs.promises.writeFile(filepath, JSON.stringify(snapshot, null, 2));
      // Cleanup old snapshots, keep last 50
      await this.cleanup(50);
    } catch (e) {
      console.error(`Failed to persist self-state snapshot: ${e}`);
    }
  }

  /**
   * Cleanup old snapshots
   */
  public async cleanup(keep: number): Promise<void> {
    if (!fs.existsSync(SELF_MODEL_DIR)) return;

    try {
      const files = (await fs.promises.readdir(SELF_MODEL_DIR))
        .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
        .sort()
        .reverse(); // Newest first

      if (files.length > keep) {
        const toDelete = files.slice(keep);
        for (const file of toDelete) {
          try {
            await fs.promises.unlink(path.join(SELF_MODEL_DIR, file));
          } catch { /* empty */ }
        }
      }
    } catch (e) {
      console.error(`Failed to cleanup self-state snapshots: ${e}`);
    }
  }

  /**
   * Load the most recent snapshot
   */
  public loadLatest(): SelfModelState | null {
    try {
      if (!fs.existsSync(SELF_MODEL_DIR)) return null;

      const files = fs.readdirSync(SELF_MODEL_DIR)
        .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
        .sort()
        .reverse(); // Newest first

      if (files.length === 0) return null;

      const content = fs.readFileSync(path.join(SELF_MODEL_DIR, files[0]), 'utf-8');
      const snapshot = JSON.parse(content) as SelfStateSnapshot;
      return snapshot.state;
    } catch (e) {
      console.error(`Failed to load latest self-state: ${e}`);
      return null;
    }
  }

  /**
   * Get history of states
   */
  public getHistory(limit: number = 10): SelfStateSnapshot[] {
    try {
      if (!fs.existsSync(SELF_MODEL_DIR)) return [];

      const files = fs.readdirSync(SELF_MODEL_DIR)
        .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);

      return files.map(file => {
        const content = fs.readFileSync(path.join(SELF_MODEL_DIR, file), 'utf-8');
        return JSON.parse(content) as SelfStateSnapshot;
      });
    } catch (e) {
      console.error(`Failed to load self-state history: ${e}`);
      return [];
    }
  }
}
