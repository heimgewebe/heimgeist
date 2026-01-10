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

    const bundle: SelfStateBundle = {
      schema: 'heimgeist.self_state.bundle.v1',
      current,
      history: limitedHistory
    };

    const filename = 'self_state.json';
    const filepath = path.join(this.dirPath, filename);
    const tmpFilepath = path.join(this.dirPath, `${filename}.tmp`);

    try {
      fs.writeFileSync(tmpFilepath, JSON.stringify(bundle, null, 2));
      fs.renameSync(tmpFilepath, filepath);
    } catch (e) {
      console.error(`Failed to write artifact bundle: ${e}`);
      // Try to cleanup tmp file
      try {
        if (fs.existsSync(tmpFilepath)) fs.unlinkSync(tmpFilepath);
      } catch (ignored) { /* empty */ }
    }
  }
}
