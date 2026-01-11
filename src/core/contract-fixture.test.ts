import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import { SelfStateBundle, SelfModelState } from '../types';

// Load schemas from local assets (mirror of metarepo)
const loadSchema = (name: string) => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../../tests/assets/schemas/heimgeist', name), 'utf-8'));
  // Remove $schema to avoid needing to load the meta-schema in test env
  delete schema.$schema;
  return schema;
};

const selfStateSchema = loadSchema('self_state.schema.json');
const bundleSchema = loadSchema('self_state.bundle.v1.schema.json');

describe('Contract Compliance (Schema Validation)', () => {
    let ajv: Ajv;
    let validateBundle: any;

    beforeAll(() => {
        ajv = new Ajv({
            allErrors: true,
            strict: false // Relax strict mode for $id resolution in test env if needed
        });
        addFormats(ajv);

        // Add referenced schema first
        ajv.addSchema(selfStateSchema);
        validateBundle = ajv.compile(bundleSchema);
    });

    it('SelfStateBundle should validate against JSON schema', () => {
        const bundle: SelfStateBundle = {
            schema: 'heimgeist.self_state.bundle.v1',
            current: {
                confidence: 0.95,
                fatigue: 0.1,
                risk_tension: 0.2,
                autonomy_level: 'aware',
                last_updated: new Date().toISOString(),
                basis_signals: ['signal1']
            },
            history: [
                {
                    timestamp: new Date().toISOString(),
                    state: {
                         confidence: 0.9,
                         fatigue: 0.2,
                         risk_tension: 0.1,
                         autonomy_level: 'aware',
                         last_updated: new Date().toISOString(),
                         basis_signals: []
                    }
                }
            ]
        };

        const valid = validateBundle(bundle);
        if (!valid) {
            console.error(validateBundle.errors);
        }
        expect(valid).toBe(true);
    });

    it('should fail validation if required fields are missing', () => {
        const invalidBundle = {
            schema: 'heimgeist.self_state.bundle.v1',
            // Missing current
            history: []
        };

        const valid = validateBundle(invalidBundle);
        expect(valid).toBe(false);
    });

    it('should fail validation if field types are incorrect', () => {
        const invalidBundle = {
            schema: 'heimgeist.self_state.bundle.v1',
            current: {
                confidence: "high", // Wrong type, should be number
                fatigue: 0.1,
                risk_tension: 0.2,
                autonomy_level: 'aware',
                last_updated: new Date().toISOString(),
                basis_signals: []
            },
            history: []
        };

        const valid = validateBundle(invalidBundle);
        expect(valid).toBe(false);
    });
});
