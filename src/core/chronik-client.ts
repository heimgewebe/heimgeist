import { ChronikClient, ChronikEvent, HeimgeistInsightEvent, HeimgeistSelfStateSnapshotEvent } from '../types';

/**
 * Real Chronik Client implementation.
 * Connects to the Chronik service via HTTP.
 */
export class RealChronikClient implements ChronikClient {
  private ingestUrl: string;
  private apiUrl?: string;

  constructor(ingestUrl?: string, apiUrl?: string) {
    this.ingestUrl = ingestUrl || process.env.CHRONIK_INGEST_URL || 'http://localhost:3000/ingest';
    this.apiUrl = apiUrl || process.env.CHRONIK_API_URL;
  }

  async nextEvent(types: string[]): Promise<ChronikEvent | null> {
    // If no API URL is configured, we can't poll.
    if (!this.apiUrl) return null;

    // TODO: Implement actual polling logic when Chronik provides a consumer API.
    // Currently, Heimgeist relies on Plexer pushing events to it via webhook/HTTP.
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
