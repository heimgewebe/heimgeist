# Heimgeist Insight Event Specification (v1)

This specification defines the contract for persisting Heimgeist Insights to Chronik.

## Protocol
*   **Domain:** heimgeist
*   **Transport:** `POST /ingest/heimgeist` (Headers: `X-Auth`)

## Event Wrapper
The event must be wrapped in a strict JSON structure:

```json
{
  "kind": "heimgeist.insight",
  "version": 1,
  "id": "evt-${insight.id}",
  "meta": {
    "occurred_at": "ISO8601 Timestamp",
    "role": "archivist",
    "schema_version": "1.0.0",
    "idempotency_key": "sha256-hash"
  },
  "data": {
    "insight_type": "string (pattern|risk|drift...)",
    "summary": "string (Title)",
    "details": "string (Description)",
    "context_refs": "object (Optional context)",
    "origin": "object (Full Insight Dump)"
  }
}
```

## Rules
1.  **ID Generation:** Must use `evt-${insight.id}`. If `insight.id` is missing, use a deterministic hash of the content.
2.  **Timestamp:** `meta.occurred_at` must be the original insight timestamp in ISO 8601 format.
3.  **Role:** `meta.role` must be set to `archivist` (the agent persisting the event).
4.  **Data Contract:** `data` must adhere to the schema above. The full original insight should be preserved in `data.origin`.
5.  **Payload:** Large fields in `origin` or `details` should be truncated to prevent transport failures.
