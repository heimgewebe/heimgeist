import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHeimgeist, Heimgeist } from '../src/core';
import { EventType, ChronikEvent, HeimgeistRole } from '../src/types';
import { v4 as uuidv4 } from 'uuid';

// Mock fetch
const originalFetch = global.fetch;

describe('Smoke Test: Artifact Ingestion', () => {
    let heimgeist: Heimgeist;
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'heimgeist-test-'));

        // Mock ARTIFACTS_DIR via process.env or just rely on fetchAndSaveArtifact injection if we exposed it (we didn't publically).
        // Since ARTIFACTS_DIR is a constant in config/state-paths.ts, it's hard to mock without jest.mock.
        // However, we modified fetchAndSaveArtifact to take a directory argument, but we can't easily call it from here as it's private.
        // Wait, fetchAndSaveArtifact defaults to ARTIFACTS_DIR.

    });

    afterEach(() => {
        if (tempDir && fs.existsSync(tempDir)) {
           fs.rmSync(tempDir, { recursive: true, force: true });
        }
        global.fetch = originalFetch;
    });

    it('should fetch and save artifact when KnowledgeObservatoryPublished event is received', async () => {
        const mockData = {
            observatory_id: "obs-1",
            generated_at: new Date().toISOString(),
            source: "semantah",
            counts: { total: 42 }, // Extra prop allowed
            topics: [],
            signals: {},
            blind_spots: [],
            considered_but_rejected: []
        };
        const testArtifactPath = path.join(tempDir, 'knowledge.observatory.json');

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => mockData,
            headers: { get: () => '500' }
        } as any);

        heimgeist = createHeimgeist({
            autonomyLevel: 2,
            activeRoles: [HeimgeistRole.Observer],
            policies: [],
            eventSources: [],
            outputs: [],
            persistenceEnabled: false,
            artifactsDir: tempDir // Injected via new config
        });

        const event: ChronikEvent = {
            id: uuidv4(),
            type: EventType.KnowledgeObservatoryPublished,
            timestamp: new Date(),
            source: 'semantah',
            payload: {
                url: 'https://localhost/knowledge.observatory.json'
            }
        };

        await heimgeist.processEvent(event);

        expect(fs.existsSync(testArtifactPath)).toBe(true);
        const savedContent = JSON.parse(fs.readFileSync(testArtifactPath, 'utf-8'));
        expect(savedContent.observatory_id).toBe(mockData.observatory_id);
    });

    it('should fetch and save artifact when IntegritySummaryPublished event is received', async () => {
        const mockData = {
            repo: "heimgeist",
            generated_at: new Date().toISOString(),
            status: "ok",
            counts: { passed: 10, failed: 0, skipped: 0 }
        };
        const testArtifactPath = path.join(tempDir, 'integrity.summary.json');

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => mockData,
            headers: { get: () => '500' }
        } as any);

        heimgeist = createHeimgeist({
            autonomyLevel: 2,
            activeRoles: [HeimgeistRole.Observer],
            policies: [],
            eventSources: [],
            outputs: [],
            persistenceEnabled: false,
            artifactsDir: tempDir // Injected via new config
        });

        const event: ChronikEvent = {
            id: uuidv4(),
            type: EventType.IntegritySummaryPublished,
            timestamp: new Date(),
            source: 'wgx',
            payload: {
                url: 'https://localhost/integrity.summary.json'
            }
        };

        await heimgeist.processEvent(event);

        expect(fs.existsSync(testArtifactPath)).toBe(true);
        const savedContent = JSON.parse(fs.readFileSync(testArtifactPath, 'utf-8'));
        expect(savedContent.status).toBe("ok");
    });

    it('should fail to save artifact with invalid schema', async () => {
        const mockData = {
            // Missing required fields
            status: "broken"
        };
        const testArtifactPath = path.join(tempDir, 'integrity.summary.json');

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => mockData,
            headers: { get: () => '500' }
        } as any);

        heimgeist = createHeimgeist({
            autonomyLevel: 2,
            activeRoles: [HeimgeistRole.Observer],
            policies: [],
            eventSources: [],
            outputs: [],
            persistenceEnabled: false,
            artifactsDir: tempDir
        });

        const event: ChronikEvent = {
            id: uuidv4(),
            type: EventType.IntegritySummaryPublished,
            timestamp: new Date(),
            source: 'wgx',
            payload: {
                url: 'https://localhost/integrity.summary.json'
            }
        };

        await heimgeist.processEvent(event);

        expect(fs.existsSync(testArtifactPath)).toBe(false);
    });
});
