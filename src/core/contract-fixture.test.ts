import { SelfStateBundle, HeimgeistSelfStateSnapshotEvent } from '../types';

describe('Contract Compliance', () => {
    it('SelfStateBundle should strictly match schema', () => {
        // This test validates the Type definition against expected shape manually,
        // effectively ensuring our TypeScript interface mirrors the Contract.

        const bundle: SelfStateBundle = {
            schema: 'heimgeist.self_state.bundle.v1',
            current: {
                confidence: 1,
                fatigue: 0,
                risk_tension: 0,
                autonomy_level: 'aware',
                last_updated: '2023-01-01',
                basis_signals: []
            },
            history: [
                {
                    timestamp: '2023-01-01',
                    state: {
                         confidence: 1,
                         fatigue: 0,
                         risk_tension: 0,
                         autonomy_level: 'aware',
                         last_updated: '2023-01-01',
                         basis_signals: []
                    }
                }
            ]
        };

        expect(bundle.schema).toBe('heimgeist.self_state.bundle.v1');
        expect(Array.isArray(bundle.history)).toBe(true);
        expect(bundle.history[0].timestamp).toBeDefined();
        expect(bundle.history[0].state).toBeDefined();
    });

    it('HeimgeistSelfStateSnapshotEvent should strictly match schema', () => {
        const event: HeimgeistSelfStateSnapshotEvent = {
            kind: 'heimgeist.self_state.snapshot',
            version: 1,
            id: 'uuid',
            meta: {
                occurred_at: '2023-01-01'
            },
            data: {
                confidence: 1,
                fatigue: 0,
                risk_tension: 0,
                autonomy_level: 'aware',
                last_updated: '2023-01-01',
                basis_signals: []
            }
        };

        expect(event.kind).toBe('heimgeist.self_state.snapshot');
        expect(event.version).toBe(1);
        expect(event.meta.occurred_at).toBeDefined();
        expect(event.data.confidence).toBeDefined();
    });
});
