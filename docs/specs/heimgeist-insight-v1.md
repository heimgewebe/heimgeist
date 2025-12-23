# Heimgeist Insight Event Specification (v1)

**Source of Truth:** This document is a **derived explanation**. The canonical source of truth is defined in the `metarepo` at `contracts/heimgeist.insight.v1.schema.json`.

All implementations must validate against the Metarepo schema.

## Protocol
*   **Domain:** heimgeist
*   **Transport:** `POST /ingest/heimgeist` (Headers: `X-Auth`)

## Implementation Mapping
The event wrapper is constructed to satisfy the Metarepo contract (Base Envelope):

```json
{
  "kind": "heimgeist.insight",
  "version": 1,
  "id": "evt-${insight.id}",
  "meta": {
    "occurred_at": "ISO8601 Timestamp",
    "producer": "heimgeist"
  },
  "data": {
    "insight_type": "string (mapped from insight.type)",
    "summary": "string (mapped from insight.title)",
    "details": "string (mapped from insight.description)",
    "context_refs": "object (mapped from insight.context)",
    "origin": "object (Full sanitized insight dump, preserving original role)"
  }
}
```

## Rules (Heimgeist Specific)
1.  **ID Generation:** Must use `evt-${insight.id}`. If `insight.id` is missing, use a deterministic hash of the content: `evt-${sha256(content).slice(0,32)}`.
2.  **Timestamp:** `meta.occurred_at` must be the original insight timestamp in ISO 8601 format.
3.  **Producer:** `meta.producer` must be strictly set to `heimgeist`. The internal role (e.g. "observer") is preserved in `data.origin.role`.
4.  **Payload:** Large fields in `origin` or `details` are truncated to prevent transport failures.
