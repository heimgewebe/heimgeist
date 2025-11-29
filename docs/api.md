# Heimgeist – API Overview

Heimgeist stellt eine schlanke, stabile API zur Verfügung, über die andere Systeme (HausKI, WGX, externe Tools) Analysen oder Systemreflexionen anstoßen können.

⸻

## Endpoints

### POST /api/analyze

Führt eine systemische Analyse aus.

#### Request

```json
{
  "mode": "quick" | "deep",
  "sources": ["repo:heimgewebe/metarepo", "event:chronik/123"],
  "hint": "optional kurzer Hinweis",
  "context": { "pr": 17 }
}
```

#### Response

```json
{
  "status": "ok",
  "result": {
    "summary": "<kurzer Satz>",
    "observations": ["...", "..."],
    "risks": ["...", "..."],
    "delegations": [
      { "target": "hauski", "action": "assist", "reason": "lokale Interaktion nötig" }
    ]
  }
}
```

⸻

### POST /api/explain

Erklärt einen Analysepfad oder eine Entscheidung.

#### Request

```json
{ "topic": "wgx.guard", "depth": 2 }
```

Response liefert Klartext + optional Diagramm.

⸻

### GET /api/status

Ermittelt Zustand des Heimgewebes aus Sicht Heimgeists.

⸻

## Philosophie
	•	Heimgeist liefert Begründungen, nicht nur Outputs.
	•	Heimgeist delegiert aktiv, aber führt selbst nichts Lokal-Konkretes aus.
	•	Jede Entscheidung ist nachvollziehbar über Beobachtungs-Graphen.
