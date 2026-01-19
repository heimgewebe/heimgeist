import { RealChronikClient } from '../src/core/chronik-client';

describe('RealChronikClient', () => {
    // Access private methods for testing
    const getClient = (url?: string) => new RealChronikClient(url) as any;

    describe('normalizeUrl', () => {
        it('should append suffix if missing', () => {
            const client = getClient();
            expect(client.normalizeUrl('http://localhost:3000', '/v1/ingest')).toBe('http://localhost:3000/v1/ingest');
        });

        it('should not append suffix if present', () => {
            const client = getClient();
            expect(client.normalizeUrl('http://localhost:3000/v1/ingest', '/v1/ingest')).toBe('http://localhost:3000/v1/ingest');
        });

        it('should handle trailing slashes', () => {
            const client = getClient();
            expect(client.normalizeUrl('http://localhost:3000/', '/v1/ingest')).toBe('http://localhost:3000/v1/ingest');
        });
    });

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
    });
});
