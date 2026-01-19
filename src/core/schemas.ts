/**
 * Minimal schemas for validation of external artifacts.
 * These are used as "Validation Gates" before ingesting artifacts into the system.
 */

export const KnowledgeObservatorySchema = {
  type: 'object',
  properties: {
    generated_at: { type: 'string' },
    schema: { type: 'string' }, // e.g. "knowledge.observatory.schema.json"
    meta: { type: 'object' },
    counts: { type: 'object' },
    signals: { type: 'object' },
  },
  required: ['generated_at'],
  additionalProperties: true,
};

export const IntegritySummarySchema = {
  type: 'object',
  properties: {
    generated_at: { type: 'string' },
    status: { type: 'string' }, // e.g. "ok", "failed"
    checks: { type: 'array' },
  },
  required: ['generated_at', 'status'],
  additionalProperties: true,
};
