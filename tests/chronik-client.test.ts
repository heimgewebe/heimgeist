import { RealChronikClient } from '../src/core/chronik-client';

describe('RealChronikClient', () => {
    describe('Constructor URL Logic', () => {
        it('should correctly derive events URL from ingest base', () => {
            const client = new RealChronikClient('http://localhost:8080');
            // Cast to any to check private property
            expect((client as any).eventsUrl).toBe('http://localhost:8080/v1/events');
            expect((client as any).ingestUrl).toBe('http://localhost:8080/v1/ingest');
        });

        it('should handle ingest URL with suffix correctly', () => {
            const client = new RealChronikClient('http://localhost:8080/v1/ingest');
            expect((client as any).eventsUrl).toBe('http://localhost:8080/v1/events');
            expect((client as any).ingestUrl).toBe('http://localhost:8080/v1/ingest');
        });

        it('should handle legacy ingest URL correctly', () => {
            const client = new RealChronikClient('http://localhost:8080/ingest');
            expect((client as any).eventsUrl).toBe('http://localhost:8080/v1/events');
            expect((client as any).ingestUrl).toBe('http://localhost:8080/v1/ingest');
        });
    });
});
