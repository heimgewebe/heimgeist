import fs from 'fs';
import path from 'path';
import { createHeimgeist, Heimgeist } from '../src/core';
import { EventType, ChronikEvent, HeimgeistRole } from '../src/types';
import { v4 as uuidv4 } from 'uuid';
import { ARTIFACTS_DIR } from '../src/config/state-paths';

// Mock fetch
const originalFetch = global.fetch;

describe('Smoke Test: Artifact Ingestion', () => {
    let heimgeist: Heimgeist;
    const testArtifactPath = path.join(ARTIFACTS_DIR, 'knowledge.observatory.json');

    beforeAll(() => {
        if (!fs.existsSync(ARTIFACTS_DIR)) {
            fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
        }
    });

    afterEach(() => {
        if (fs.existsSync(testArtifactPath)) {
            fs.unlinkSync(testArtifactPath);
        }
        global.fetch = originalFetch;
    });

    it('should fetch and save artifact when KnowledgeObservatoryPublished event is received', async () => {
        // Setup mock response
        const mockData = {
            generated_at: new Date().toISOString(),
            schema: 'knowledge.observatory.schema.json',
            counts: { total: 42 }
        };

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => mockData,
            text: async () => JSON.stringify(mockData) // observe also calls .text()
        } as any);

        heimgeist = createHeimgeist({
            autonomyLevel: 2,
            activeRoles: [HeimgeistRole.Observer],
            policies: [],
            eventSources: [],
            outputs: [],
            persistenceEnabled: false
        });

        const event: ChronikEvent = {
            id: uuidv4(),
            type: EventType.KnowledgeObservatoryPublished,
            timestamp: new Date(),
            source: 'semantah',
            payload: {
                url: 'https://example.com/knowledge.observatory.json'
            }
        };

        await heimgeist.processEvent(event);

        expect(fs.existsSync(testArtifactPath)).toBe(true);
        const savedContent = JSON.parse(fs.readFileSync(testArtifactPath, 'utf-8'));
        expect(savedContent.counts.total).toBe(42);
        expect(savedContent.generated_at).toBe(mockData.generated_at);
    });
});
