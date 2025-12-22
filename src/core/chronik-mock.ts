import { ChronikEvent, EventType, ChronikClient } from '../types';

/**
 * Mock Chronik Client for development and testing.
 * This class simulates a stream of events from the Chronik event log.
 *
 * NOTE: This is a DEV-HELPER and is exported for use in the CLI demo
 * and integration tests. It is not intended for production usage in a
 * real Heimgewebe deployment (which would use a real Chronik adapter).
 */
export class MockChronikClient implements ChronikClient {
  private events: ChronikEvent[] = [];

  constructor() {
    // Seed with a sample event if empty?
    // For now, we allow injecting events manually or via a "seed" method.
  }

  // Method to inject an event (for testing/demo)
  addEvent(event: ChronikEvent) {
    this.events.push(event);
  }

  async nextEvent(types: string[]): Promise<ChronikEvent | null> {
    // Simple FIFO for the mock
    if (this.events.length > 0) {
      const event = this.events.shift();
      if (event && types.includes(event.type as EventType)) {
        return event;
      }
      // If event type doesn't match, maybe put it back or discard?
      // For this simple mock, we assume we only feed relevant events.
      if (event) return event;
    }
    return null;
  }

  async append(event: ChronikEvent): Promise<void> {
    console.log(`[MockChronik] Appended event: ${event.type}`, event.payload);
  }
}
