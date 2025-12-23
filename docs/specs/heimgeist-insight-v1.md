# Heimgeist Insight Event Specification (v1)

**Source of Truth:** This implementation follows the schema defined in `metarepo` (see `heimgewebe.events.v1` definitions). This document serves as Implementation Notes.

## Protocol
*   **Domain:** heimgeist
*   **Transport:** `POST /ingest/heimgeist` (Headers: `X-Auth`)

## Implementation Mapping
The event wrapper is constructed to satisfy the Metarepo contract:

```json
{
  "kind": "heimgeist.insight",
  "version": 1,
  "id": "evt-${insight.id}",
  "meta": {
    "occurred_at": "ISO8601 Timestamp",
    "role": "archivist"
  },
  "data": {
    "insight_type": "string (mapped from insight.type)",
    "summary": "string (mapped from insight.title)",
    "details": "string (mapped from insight.description)",
    "context_refs": "object (mapped from insight.context)",
    "origin": "object (Full sanitized insight dump)"
  }
}
```

## Rules
1.  **ID Generation:** Must use `evt-${insight.id}`. If `insight.id` is missing, use a deterministic hash of the content.
2.  **Timestamp:** `meta.occurred_at` must be the original insight timestamp in ISO 8601 format.
3.  **Role:** `meta.role` must be set to `archivist` (the agent persisting the event).
4.  **Payload:** Large fields in `origin` or `details` are truncated to prevent transport failures.
