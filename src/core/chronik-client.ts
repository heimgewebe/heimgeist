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
    let baseIngest = ingestUrl || process.env.CHRONIK_INGEST_URL || 'http://localhost:3000';

    // If user provided a full URL, strip suffix to get base for derivation
    // normalizeUrl handles appending correctly even if suffix is missing or legacy.

    // For ingestUrl, we just run normalization on whatever input we have
    this.ingestUrl = this.normalizeUrl(baseIngest, '/v1/ingest');

    // For eventsUrl derivation, we need a clean base if CHRONIK_API_URL is missing.
    // If baseIngest was a full URL, we strip suffixes.
    let cleanBase = baseIngest;
    if (cleanBase.endsWith('/v1/ingest')) cleanBase = cleanBase.replace(/\/v1\/ingest$/, '');
    else if (cleanBase.endsWith('/ingest')) cleanBase = cleanBase.replace(/\/ingest$/, '');
    // Also strip trailing slash
    if (cleanBase.endsWith('/')) cleanBase = cleanBase.slice(0, -1);

    const rawEventsUrl = eventsUrl || process.env.CHRONIK_API_URL || cleanBase;
    this.eventsUrl = this.normalizeUrl(rawEventsUrl, '/v1/events');

    this.domain = process.env.CHRONIK_INGEST_DOMAIN || 'heimgeist.events';

    // Domain Usage Warning:
    // If domain looks generic and doesn't start with 'heimgeist.', we warn to prevent
    // accidental consumption of shared/global streams by this specific agent.
    if (!this.domain.startsWith('heimgeist.') && !process.env.CHRONIK_SILENCE_DOMAIN_WARN) {
        console.warn(`[ChronikClient] Warning: Using generic domain '${this.domain}'. Ensure this is intended, as Heimgeist consumes (skips) non-matching events from this stream.`);
    }

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

  private getCursor(): number | null {
      try {
          if (fs.existsSync(this.cursorFile)) {
              const val = parseInt(fs.readFileSync(this.cursorFile, 'utf-8').trim(), 10);
              return isNaN(val) ? null : val;
          }
      } catch (e) { /* ignore */ }
      return null;
  }

  private setCursor(cursor: number): void {
      try {
          fs.writeFileSync(this.cursorFile, cursor.toString());
      } catch (e) { /* ignore */ }
  }

  async nextEvent(types: string[]): Promise<ChronikEvent | null> {
    // Loop limited to prevent infinite blocking, but high enough to skip sparse streams.
    // CHRONIK_MAX_SKIP defaults to 50.
    const maxSkips = parseInt(process.env.CHRONIK_MAX_SKIP || '50', 10);
    let currentCursor = this.getCursor();

    for (let i = 0; i < maxSkips; i++) {
        try {
            const url = new URL(this.eventsUrl);
            url.searchParams.set('domain', this.domain);
            url.searchParams.set('limit', '1');
            if (currentCursor !== null) {
                url.searchParams.set('cursor', currentCursor.toString());
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(url.toString(), {
                signal: controller.signal,
                headers: {
                    ...(process.env.CHRONIK_TOKEN ? { 'X-Auth': process.env.CHRONIK_TOKEN } : {}),
                },
            }).finally(() => clearTimeout(timeout));

            if (!response.ok) {
                console.warn(`[ChronikClient] Failed to poll events: ${response.status} ${response.statusText}`);
                return null;
            }

            const body = await response.json() as { events: ChronikEvent[], next_cursor?: number | null, has_more?: boolean };

            // If events > 0 but next_cursor is missing, we check has_more.
            // If has_more is explicitly false, we reached end.
            if (body.next_cursor === undefined || body.next_cursor === null) {
                if (body.has_more === false) {
                    return null; // Clean EOF
                }
                // If we got events but no cursor and has_more isn't false, we might be stuck.
                if (body.events && body.events.length > 0) {
                    console.warn('[ChronikClient] Received events but no next_cursor. Pagination might be stuck.');
                }
                return null;
            }

            const nextCursor = typeof body.next_cursor === 'number' ? body.next_cursor : parseInt(String(body.next_cursor), 10);

            if (isNaN(nextCursor)) {
                console.warn('[ChronikClient] Received invalid non-numeric next_cursor.');
                return null;
            }

            // If cursor hasn't moved, we are at the end (or stuck).
            if (currentCursor !== null && nextCursor <= currentCursor) {
                // Defensive check: if next_cursor is same or smaller, and we got events, something is wrong with pagination or we wrapped?
                // Chronik guarantees monotonic cursor (byte offset).
                // But if we retry loop, we might see same cursor if we didn't advance.
                if (nextCursor === currentCursor) return null;
            }

            // Advance in-memory cursor for next iteration
            currentCursor = nextCursor;

            if (body.events && body.events.length > 0) {
                const event = body.events[0];
                // Filter by types locally
                if (types.includes(event.type as any)) {
                    // Match found! Commit cursor and return event
                    this.setCursor(nextCursor);
                    return event;
                } else {
                    // Mismatch. Update disk cursor so we don't re-scan this ignored event next time.
                    // This counts as "consuming" (discarding) the event to prevent head-of-line blocking.
                    // ARCHITECTURAL NOTE: This implies Heimgeist "eats" events from this cursor stream.
                    // If multiple independent consumers share a cursor, this is problematic.
                    // Currently, Heimgeist maintains its own private cursor file, so this is safe.

                    // console.log(`[ChronikClient] Skipping event ${event.id} of type ${event.type} (filter mismatch)`);
                    this.setCursor(nextCursor);
                    // Continue loop to try finding a matching event in next slot
                }
            } else {
                // No events returned but cursor advanced (e.g. keepalive or sparse). Commit and continue.
                this.setCursor(nextCursor);
            }
        } catch (error) {
            console.warn(`[ChronikClient] Failed to poll Chronik: ${error}`);
            return null;
        }
    }
    return null;
  }

  private normalizeUrl(baseUrl: string, suffix: string): string {
      // Remove trailing slash
      let url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

      // Check if it ends with correct suffix
      if (url.endsWith(suffix)) {
          return url;
      }

      // Handle legacy suffix replacement (e.g., /ingest -> /v1/ingest)
      // Suffix usually starts with /v1/..., so we check for the last part
      const shortSuffix = suffix.replace(/^\/v1/, ''); // e.g. /ingest

      if (url.endsWith(shortSuffix)) {
          // Replace .../ingest with .../v1/ingest
          return url.substring(0, url.lastIndexOf(shortSuffix)) + suffix;
      }

      // Fallback: append
      return `${url}${suffix}`;
  }

  async append(event: ChronikEvent | HeimgeistInsightEvent | HeimgeistSelfStateSnapshotEvent): Promise<void> {
    try {
      // Ingest Contract: POST /v1/ingest { domain, payload }
      // We map our internal event structure to the expected ingestion payload.
      // If event has 'kind', it's a new Heimgeist event. If 'type', it's generic ChronikEvent.

      const payload = event; // For now, we send the full event as payload
      const ingestBody = {
          domain: this.domain,
          payload: payload
      };

      const response = await fetch(this.ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Optional: Add auth token if available
          ...(process.env.CHRONIK_TOKEN ? { 'X-Auth': process.env.CHRONIK_TOKEN } : {}),
        },
        body: JSON.stringify(ingestBody),
      });

      if (!response.ok) {
        throw new Error(`Chronik ingest failed: ${response.status} ${response.statusText} [URL: ${this.ingestUrl}]`);
      }
    } catch (error) {
      // Log context for debugging ingest mismatches
      // console.error(`[ChronikClient] Append failed to ${this.ingestUrl}`, error);

      // We log the error but rethrow it so the caller (Archivist) knows it failed
      // The Archivist handles "Best Effort" logging.
      throw error;
    }
  }
}
