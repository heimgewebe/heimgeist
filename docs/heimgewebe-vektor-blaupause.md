# Heimgewebe-Vektor-Blaupause

**Die technische Architektur der neuen event-getriebenen Pipeline**

## Übersicht

Die Heimgewebe-Pipeline denkt GitHub nicht mehr als „Ort für Repos", sondern als **Oberfläche eines eigenen Organismus**. Alles läuft über Events, semantische Verarbeitung und orchestrierte Reflexion.

## 5-Schichten-Architektur

```
┌─────────────────────────────────────────────────────────┐
│  1. INTERAKTION (GitHub PR-Kommentare)                  │
│     @heimgewebe/sichter /quick                          │
│     @heimgewebe/wgx /guard                              │
│     @heimgewebe/heimlern /pattern-bad                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  2. EVENTS (chronik - JSONL Event Store)                │
│     - heimgewebe.command.v1                             │
│     - pr.opened, pr.merged                              │
│     - ci.result, deploy.failed                          │
│     - incident.detected, epic.linked                    │
│     - pattern.good, pattern.bad                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  3. BEDEUTUNG (semantAH - Wissensgraph)                 │
│     Knoten: PR, Incident, Epic, Pattern                 │
│     Kanten: verursacht, ähnlich, betrifft               │
│     Cluster & Embeddings                                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  4. REFLEXION (sichter - Analyse & Bewertung)           │
│     - Risikobewertung                                   │
│     - Betroffene Schichten                              │
│     - Historische Muster                                │
│     - Empfohlene Checks & Runbooks                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  5. HANDLUNG (hausKI + wgx - Orchestrierung)            │
│     - Guard/Smoke Tests                                 │
│     - CI-Runs                                           │
│     - Weitere Analysen                                  │
│     - Report-Generierung                                │
└─────────────────────────────────────────────────────────┘

        META-EBENE: Heimgeist (Meta-Agent)
        Beobachter │ Kritiker │ Regisseur │ Archivar
```

## Event-Schema

### heimgewebe.command.v1

```json
{
  "id": "evt-uuid",
  "type": "heimgewebe.command.v1",
  "timestamp": "2025-11-30T19:48:14Z",
  "source": "github-pr-comment",
  "payload": {
    "command": "/quick",
    "target": "sichter",
    "context": {
      "pr": 42,
      "repo": "heimgewebe/metarepo",
      "author": "user123",
      "comment_id": "comment-789"
    }
  },
  "metadata": {
    "dispatcher": "heimgewebe-dispatcher-v1"
  }
}
```

### pr.opened / pr.merged

```json
{
  "id": "evt-uuid",
  "type": "pr.opened",
  "timestamp": "2025-11-30T19:48:14Z",
  "source": "github-webhooks",
  "payload": {
    "pr_number": 42,
    "repo": "heimgewebe/metarepo",
    "title": "Add new feature",
    "author": "user123",
    "labels": ["enhancement"],
    "diff_url": "https://github.com/..."
  }
}
```

### incident.detected

```json
{
  "id": "evt-uuid",
  "type": "incident.detected",
  "timestamp": "2025-11-30T19:48:14Z",
  "source": "monitoring",
  "payload": {
    "severity": "high",
    "description": "Database connection timeout",
    "affected_services": ["api", "worker"],
    "context": {
      "error_rate": 0.45,
      "duration_seconds": 120
    }
  }
}
```

### epic.linked

```json
{
  "id": "evt-uuid",
  "type": "epic.linked",
  "timestamp": "2025-11-30T19:48:14Z",
  "source": "project-tracking",
  "payload": {
    "epic_id": "EPIC-123",
    "title": "Migrate to new pipeline",
    "linked_prs": [42, 43, 44],
    "phase": "implementation"
  }
}
```

### pattern.good / pattern.bad

```json
{
  "id": "evt-uuid",
  "type": "pattern.bad",
  "timestamp": "2025-11-30T19:48:14Z",
  "source": "heimlern",
  "payload": {
    "pattern_name": "sql-injection-risk",
    "occurrences": 3,
    "examples": ["pr-42", "pr-38", "pr-31"],
    "recommendation": "Use parameterized queries"
  }
}
```

## Command-Syntax

### @heimgewebe/wgx

```
@heimgewebe/wgx /guard [scope]
  - Führt Guard-Checks aus
  - scope: all | changed | affected

@heimgewebe/wgx /smoke [env]
  - Führt Smoke-Tests aus
  - env: staging | production
```

### @heimgewebe/sichter

```
@heimgewebe/sichter /quick
  - Schnelle Risikoanalyse

@heimgewebe/sichter /deep
  - Tiefgehende Analyse mit historischen Mustern

@heimgewebe/sichter /compare [pr_number]
  - Vergleicht mit anderem PR
```

### @heimgewebe/heimlern

```
@heimgewebe/heimlern /pattern-good
  - Markiert diesen PR als gutes Muster

@heimgewebe/heimlern /pattern-bad [reason]
  - Markiert diesen PR als schlechtes Muster

@heimgewebe/heimlern /similar
  - Findet ähnliche PRs
```

### @heimgewebe/metarepo

```
@heimgewebe/metarepo /link-epic [epic_id]
  - Verknüpft PR mit Epic

@heimgewebe/metarepo /visualize
  - Erzeugt Visualisierung im leitstand
```

## End-to-End-Flow

### Beispiel: PR mit /quick-Analyse

1. **Interaktion**: User schreibt `@heimgewebe/sichter /quick` in PR-Kommentar
2. **Dispatcher**: 
   - Erkennt Command
   - Erzeugt `heimgewebe.command.v1` Event
   - Schreibt nach `chronik/events.jsonl`
3. **Event Processing**:
   - Sichter liest Event aus chronik
   - Zieht PR-Kontext (Diff, Commits, CI-Status)
   - Fragt semantAH nach ähnlichen PRs
4. **Analyse**:
   - Risikobewertung: Medium
   - Betroffene Schichten: API, Database
   - Historische Muster: 2 ähnliche PRs hatten DB-Migration-Issues
5. **Report**:
   - Sichter schreibt Report als Event zurück nach chronik
   - Kommentiert auf PR mit Ergebnis
   - semantAH indexiert die Erkenntnisse
6. **Visualisierung**:
   - leitstand zeigt Timeline, Risiko-Graph, verwandte PRs

## MVP-Plan (1 Woche)

### Tag 1-2: Event-Infrastruktur
- [ ] chronik als JSONL-Store implementieren
- [ ] Event-Schema definieren und validieren
- [ ] Dispatcher für GitHub PR-Kommentare
- [ ] Event-Reader und Event-Writer

### Tag 3-4: Command-Processing
- [ ] Command-Parser für @heimgewebe mentions
- [ ] wgx-Hooks für /guard und /smoke
- [ ] sichter-Hooks für /quick und /deep
- [ ] Event-basierte Kommunikation zwischen Services

### Tag 5: Integration & Testing
- [ ] semantAH-Integration für Context-Retrieval
- [ ] Test-Suite für Event-Flow
- [ ] Documentation und Examples

### Tag 6-7: Heimgeist Meta-Agent
- [ ] Heimgeist liest Events aus chronik
- [ ] Risk-Assessment basierend auf Event-Historie
- [ ] Automatic Action Planning
- [ ] Report-Generation zurück nach chronik

## Erweiterungsplan (1-3 Monate)

### Monat 1: Semantische Schicht
- semantAH Wissensgraph aufbauen
- Embeddings für PRs, Commits, Issues
- Cluster-Erkennung für ähnliche Probleme
- Pattern-Matching mit heimlern

### Monat 2: Leitstand & Visualisierung
- Real-time Dashboard für Event-Stream
- Risiko-Heatmaps pro Repo/Epic
- Timeline-Visualisierung
- Alert-System für kritische Events

### Monat 3: Erweiterte Orchestrierung
- Multi-Tool-Chains (sichter → wgx → hausKI)
- Automatische Runbook-Execution
- Learning-Loops: Pattern-Good → Template-Export
- Host-Unabhängigkeit: Support für Forgejo/Gitea

## Integration-Points

### chronik
```typescript
// Event schreiben
await chronik.write({
  type: 'heimgewebe.command.v1',
  payload: { ... }
});

// Events lesen (Query)
const events = await chronik.query({
  type: 'ci.result',
  source: 'github-actions',
  since: Date.now() - 86400000 // last 24h
});
```

### semantAH
```typescript
// Kontext abrufen
const context = await semantAH.getContext({
  pr: 42,
  depth: 'deep',
  includeRelated: true
});

// Wissensgraph aktualisieren
await semantAH.updateGraph({
  nodes: [{ type: 'pr', id: 42, ... }],
  edges: [{ from: 'pr-42', to: 'incident-17', type: 'caused' }]
});
```

### sichter
```typescript
// Analyse anstoßen
const analysis = await sichter.analyze({
  target: 'pr-42',
  depth: 'quick',
  context: semantAHContext
});

// Report schreiben
await chronik.write({
  type: 'sichter.report.v1',
  payload: analysis
});
```

### Heimgeist
```typescript
// Event-Processing
heimgeist.on('event', async (event) => {
  const insights = await heimgeist.processEvent(event);
  
  // Bei kritischen Insights: Aktionen planen
  if (insights.some(i => i.severity === 'critical')) {
    const actions = heimgeist.planActions(insights);
    await chronik.write({
      type: 'heimgeist.actions.v1',
      payload: actions
    });
  }
});
```

## Vorteile des Designs

### 1. Host-Unabhängigkeit
- Alle Logik in Events und semantischen Schichten
- GitHub ist nur noch UI und Trigger
- Migration zu Forgejo/Gitea: nur Adapter ändern

### 2. Auditierbarkeit
- Jeder Schritt als Event in chronik
- Vollständige Timeline rekonstruierbar
- Debugging: Event-Replay möglich

### 3. Skalierbarkeit
- Services sind entkoppelt
- Event-Processing parallelisierbar
- Neue Tools einfach einbindbar

### 4. Lernfähigkeit
- Jede Entscheidung in semantAH
- Pattern-Recognition über Zeit
- Feedback-Loops über heimlern

### 5. Transparenz
- Jedes Event sichtbar im leitstand
- Risiko-Bewertung nachvollziehbar
- Entscheidungspfade dokumentiert

## Sicherheitsüberlegungen

- Events können sensible Daten enthalten → Encryption at rest
- Zugriffskontrolle auf chronik-Events
- Rate-Limiting für Command-Processing
- Validation aller Events gegen Schema
- Audit-Log für kritische Operationen

## Performance-Überlegungen

- JSONL für schnelles Append-Only Writing
- Index für häufige Queries (type, timestamp, source)
- Event-Batching für semantAH-Updates
- Caching von Context-Retrieval
- Async-Processing mit Queue

## Nächste Schritte

1. **Prototype**: Minimal Dispatcher + chronik + 1 Command
2. **Validate**: End-to-End Test mit echtem PR
3. **Iterate**: Weitere Commands, Tools, Integrations
4. **Scale**: Performance-Tuning, Monitoring, Alerts
5. **Extend**: Neue Event-Typen, Tools, Visualizations
