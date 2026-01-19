import * as fs from 'fs';
import * as path from 'path';
import { ChronikClient, ChronikEvent, HeimgeistInsightEvent, HeimgeistSelfStateSnapshotEvent } from '../types';
import { STATE_DIR } from '../config/state-paths';

/**
 * Real Chronik Client implementation.
 * Connects to the Chronik service via HTTP.
 */
export class RealChronikClient implements ChronikClient {
  private ingestUrl: string;
  private eventsUrl: string;
  private cursorFile: string;
  private domain: string;

  constructor(ingestUrl?: string, eventsUrl?: string) {
    // Ingest URL suffix: /v1/ingest
    const baseIngest = ingestUrl || process.env.CHRONIK_INGEST_URL || 'http://localhost:3000';
    this.ingestUrl = baseIngest.endsWith('/v1/ingest') ? baseIngest : `${baseIngest.replace(/\/ingest$/, '')}/v1/ingest`;

    // Events URL: /v1/events
    const baseEvents = eventsUrl || process.env.CHRONIK_API_URL || baseIngest.replace(/\/v1\/ingest$/, '');
    this.eventsUrl = `${baseEvents}/v1/events`;

    this.domain = process.env.CHRONIK_INGEST_DOMAIN || 'heimgeist.events';
    this.cursorFile = path.join(STATE_DIR, 'chronik.cursor');

    // Ensure state dir exists
    if (!fs.existsSync(STATE_DIR)) {
        fs.mkdirSync(STATE_DIR, { recursive: true });
    }
  }

  private getCursor(): string | null {
      try {
          if (fs.existsSync(this.cursorFile)) {
              return fs.readFileSync(this.cursorFile, 'utf-8').trim();
          }
      } catch (e) { /* ignore */ }
      return null;
  }

  private setCursor(cursor: string): void {
      try {
          fs.writeFileSync(this.cursorFile, cursor);
      } catch (e) { /* ignore */ }
  }

  async nextEvent(types: string[]): Promise<ChronikEvent | null> {
    try {
        const cursor = this.getCursor();
        const url = new URL(this.eventsUrl);
        url.searchParams.set('domain', this.domain);
        url.searchParams.set('limit', '1');
        if (cursor) {
            url.searchParams.set('cursor', cursor);
        }

        const response = await fetch(url.toString());
        if (!response.ok) return null;

        const body = await response.json() as { events: ChronikEvent[], next_cursor?: string };

        if (body.next_cursor) {
            this.setCursor(body.next_cursor);
        }

        if (body.events && body.events.length > 0) {
            const event = body.events[0];
            // Filter by types locally if API doesn't support type filtering or to be safe
            if (types.includes(event.type as any)) {
                return event;
            }
        }
    } catch (error) {
        // console.warn('Failed to poll Chronik:', error);
    }
    return null;
  }

  async append(event: ChronikEvent | HeimgeistInsightEvent | HeimgeistSelfStateSnapshotEvent): Promise<void> {
    try {
      const response = await fetch(this.ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Optional: Add auth token if available
          ...(process.env.CHRONIK_TOKEN ? { 'X-Auth': process.env.CHRONIK_TOKEN } : {}),
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`Chronik ingest failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // We log the error but rethrow it so the caller (Archivist) knows it failed
      // The Archivist handles "Best Effort" logging.
      throw error;
    }
  }
}
