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
    // Defaults assume standard service topology (base URL)
    // CHRONIK_INGEST_URL is typically the base URL (e.g., http://localhost:3000)
    // We strictly append /v1/ingest and /v1/events to the base.
    const baseIngest = ingestUrl || process.env.CHRONIK_INGEST_URL || 'http://localhost:3000';
    this.ingestUrl = this.normalizeUrl(baseIngest, '/v1/ingest');

    // Events URL derived from same base unless explicitly overridden
    // If derived from baseIngest which might be a full URL ending in /v1/ingest, strip suffix
    let defaultBaseEvents = baseIngest;
    if (!eventsUrl && !process.env.CHRONIK_API_URL && baseIngest.endsWith('/v1/ingest')) {
        defaultBaseEvents = baseIngest.replace(/\/v1\/ingest$/, '');
    }

    const baseEvents = eventsUrl || process.env.CHRONIK_API_URL || defaultBaseEvents;
    this.eventsUrl = this.normalizeUrl(baseEvents, '/v1/events');

    this.domain = process.env.CHRONIK_INGEST_DOMAIN || 'heimgeist.events';
    this.cursorFile = path.join(STATE_DIR, 'chronik.cursor');

    // Ensure state dir exists
    if (!fs.existsSync(STATE_DIR)) {
        fs.mkdirSync(STATE_DIR, { recursive: true });
    }
  }

  // Allow overriding domain for polling different streams (e.g. global vs personal)
  public setDomain(domain: string): void {
      this.domain = domain;
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
    // Loop limited to 5 iterations to avoid getting stuck if many consecutive events don't match types.
    // We must advance the cursor even if we don't return the event, otherwise we'd re-fetch the same ignored event forever.
    let currentCursor = this.getCursor();

    for (let i = 0; i < 5; i++) {
        try {
            const url = new URL(this.eventsUrl);
            url.searchParams.set('domain', this.domain);
            url.searchParams.set('limit', '1');
            if (currentCursor) {
                url.searchParams.set('cursor', currentCursor);
            }

            const response = await fetch(url.toString(), {
                headers: {
                    ...(process.env.CHRONIK_TOKEN ? { 'X-Auth': process.env.CHRONIK_TOKEN } : {}),
                },
            });

            if (!response.ok) return null;

            const body = await response.json() as { events: ChronikEvent[], next_cursor?: string | number | null };

            // If no next_cursor or it hasn't moved, we are at the end
            if (body.next_cursor === undefined || body.next_cursor === null || String(body.next_cursor) === currentCursor) {
                return null;
            }

            const nextCursorStr = String(body.next_cursor);

            // Advance in-memory cursor for next iteration
            currentCursor = nextCursorStr;

            if (body.events && body.events.length > 0) {
                const event = body.events[0];
                // Filter by types locally
                if (types.includes(event.type as any)) {
                    // Match found! Commit cursor and return event
                    this.setCursor(nextCursorStr);
                    return event;
                } else {
                    // Mismatch. We must skip this event.
                    // We commit the cursor now so we don't re-process this ignored event if we crash/exit loop.
                    this.setCursor(nextCursorStr);
                    // Continue loop to try finding a matching event in next slot
                }
            } else {
                // No events returned but cursor advanced (e.g. keepalive or sparse). Commit and continue.
                this.setCursor(nextCursorStr);
            }
        } catch (error) {
            // console.warn('Failed to poll Chronik:', error);
            return null;
        }
    }
    return null;
  }

  private normalizeUrl(baseUrl: string, suffix: string): string {
      // Remove trailing slash
      let url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

      // If url already ends with suffix, return it
      if (url.endsWith(suffix)) {
          return url;
      }

      // Handle legacy suffixes (e.g. /ingest -> /v1/ingest) if strictly needed,
      // but here we just ensure we append the suffix if missing.
      // We also handle cases where the user might have provided a partial path like /ingest (legacy)
      // but we want to enforce /v1/ingest.
      // For robustness: if it ends with /ingest or /events (without v1), we replace it?
      // The requirement says: robust normalization.

      // Simple strategy: append suffix.
      // But if user gave '.../v1/events' and we want '/v1/events', we are good.
      // If user gave '.../ingest' and we want '/v1/ingest', we should probably strip last segment?
      // Let's stick to the prompt's suggestion:
      // normalizeIngestUrl(x): endsWith('/v1/ingest') ? x : join(x, '/v1/ingest')

      return `${url}${suffix}`;
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
