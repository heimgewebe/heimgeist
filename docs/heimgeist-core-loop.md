# Heimgeist Core Loop – Minimaler Organismus-Kern

> Zweck: Definiert den kleinsten lauffähigen Kern von Heimgeist als Meta-Agent,
> der Ereignisse liest, Risiken bewertet, Einsichten generiert und Handlungen
> vorschlägt – im Sinne des Heimgewebe-Organismus.

## 1. Kontext

Heimgeist ist bereits als Meta-Agent und Nervensystem des Heimgewebes beschrieben:

- Orchestriert spezialisierte Agenten (sichter, wgx, hausKI, heimlern, semantAH).
- Arbeitet event-getrieben über `chronik`.
- Bewertet Risiken, Annahmen und Alternativen.
- Besitzt graduelle Autonomie-Level (0–3).

Dieser Core Loop beschreibt die **konkrete, minimal notwendige Schleife**, um Heimgeist
von „Vision“ zu einem **laufenden Organismus-Kern** zu machen.

---

## 2. Zielbild dieses Core Loops

Minimalziel:

1. Heimgeist kann **Events aus `chronik`** lesen (mindestens: `ci.result`, `pr.opened`, `pr.merged`).
2. Heimgeist kann daraus **Risiken & Muster** ableiten (heuristisch, später lernend).
3. Heimgeist erzeugt **Insights** (mit `why`) und **empfohlene Aktionen**.
4. Heimgeist kann – je nach Autonomie-Level –
   - nur berichten (Level 1–2)
   - oder vorbereitete Aktionen anstoßen (Level 2–3, z. B. `sichter.quick_analysis`, `wgx.guard`).

---

## 3. Inputs und Outputs

### 3.1 Inputs

Events aus `chronik` (Plexer):

- `ci.result`
  - Felder (Minimum):
    - `pipeline_id`
    - `repo`
    - `branch`
    - `status` (`success` | `failed` | `cancelled`)
    - `trigger` (`pr`, `push`, `manual`)
    - `linked_pr` (optional: PR-Nummer)
- `pr.opened`
- `pr.merged`
- `heimgewebe.command.v1` (Direkte Befehle via PR-Kommentare)
- `deploy.failed`
- `incident.detected`

Hinweis: Während diese Events bereits akzeptiert und persistiert werden, ist die spezialisierte Risikologik in v1 primär auf `ci.result` fokussiert.

Später erweiterbar (nur referenziert, nicht notwendig für v1):

- `pattern.bad` / `pattern.good`

### 3.2 Outputs

Heimgeist schreibt **zwei primäre Artifacts**:

1. **Insights**
   - Speicherort: `heimgeist_state/insights/*.json`
   - Felder:
     - `id`
     - `timestamp`
     - `source_event`
     - `severity` (`info|warning|critical`)
     - `summary`
     - `why`
     - `related_entities` (PRs, Repos, Workflows, Incidents)

2. **Actions** (empfohlen oder pending)
   - Speicherort: `heimgeist_state/actions/*.json`
   - Felder:
     - `id`
     - `timestamp`
     - `status` (`pending|approved|executed|rejected`)
     - `kind` (z. B. `run_wgx_guard`, `trigger_sichter_quick`, `open_incident`)
     - `target` (Repo, PR, Workflow)
     - `reason` (Verweis auf Insight-ID)
     - `autonomy_required` (Mindestlevel)

Optional/Zukunft:

- Export in `chronik` als Events: `heimgeist.insight.v1`, `heimgeist.action.proposed.v1`.

---

## 4. Der Core Loop (logische Schritte)

Der Core Loop folgt einem einfachen Schema:

1. **Pull**: Neues Event aus `chronik` holen.
2. **Kontext aufbauen** (ggf. via semantAH, historischer Verlauf).
3. **Risiko bewerten**.
4. **Insights generieren**.
5. **Aktionen vorschlagen** (abhängig vom Autonomie-Level).
6. **Persistieren & optional eventen**.
7. **(Optional) Nicht-destruktive Aktionen ausführen**.

### 4.1 Pseudocode

```ts
while (true) {
  const event = chronik.nextEvent({
    types: ['ci.result', 'pr.opened', 'pr.merged', 'heimgewebe.command.v1', ...]
  });

  if (!event) {
    sleep(SHORT_INTERVAL);
    continue;
  }

  const context = await buildContext(event);
  const risk = assessRisk(event, context);
  const insights = deriveInsights(event, context, risk);
  const actions = proposeActions(event, context, risk, insights, autonomyLevel);

  await persistInsights(insights);
  await persistActions(actions);

  if (autonomyLevel >= 2) {
    const safeActions = filterNonDestructive(actions);
    await executeSafeActions(safeActions);
  }
}
```

---

## 5. Risiko-Assessment (v1 – heuristisch)

Ziel: Einfache, aber sinnvolle Heuristik, die später durch heimlern ersetzt/erweitert werden kann.

Beispiele:
- `ci.result.status == 'failed'` UND `trigger == 'pr'`
  → `risk.level = 'medium'` (Implementiert).
  - Vision: `high`, insbesondere wenn derselbe PR bereits mehrfach CI-Fehler erzeugt hat.
- `ci.result.status == 'failed'` auf `main`
  → `risk.level = 'critical'` (Zielverhalten).
- `pr.opened` mit Änderungen in bestimmten Pfaden (`.github/workflows/**`, `infra/**`)
  → `risk.level = 'elevated'`.

Jeder Risk-Score muss ein `why` enthalten, z. B.:

„CI-Failure auf main in Repo X, betroffenes Modul: Auth-Layer, vergleichbar mit Incident Y.“

---

## 6. Autonomie-Level-Mapping

Aus dem Heimgeist-Kontext:
- **Level 0 – passiv:** nur auf Anfrage.
- **Level 1 – beobachtend:** liest Events, speichert Insights, aber keine proaktiven Aktionen.
- **Level 2 – warnend:** generiert Insights + schlägt Aktionen vor, darf nicht-destruktive Aktionen ausführen (z. B. `sichter.quick_analysis`).
- **Level 3 – operativ:** darf bestimmte Aktionen eigenständig ausführen, z. B. `wgx.guard`.

### 6.1 Konkrete Zuordnung

- **Level 1**
  - Aktionen nur als `status: "pending"`.
  - Keine Auto-Trigger von Tools.
- **Level 2 (Default empfohlen)**
  - Darf:
    - `sichter.quick_analysis` für PRs mit `risk >= high`.
    - `chronik.append_event` (Meta-Events, Insights).
  - Braucht Bestätigung für:
    - `wgx.guard`,
    - `wgx.smoke`,
    - PR-Modifikationen.
- **Level 3**
  - Darf zusätzlich:
    - `wgx.guard` automatisiert auslösen bei `main`-Fehlern.
    - Auto-Incidents anlegen.

---

## 7. Erster vertikaler Slice (konkret implementieren)

### 7.1 Scope

Nur einen einzigen Flow wirklich implementieren:

**Flow:**
„CI-Failure auf main → Heimgeist erkennt kritisches Risiko →
Insight erzeugt → Aktion ‚wgx.guard empfehlen‘.“

Schritte:
1. `chronik` liefert `ci.result`-Events mit `status=failed` und Branch `main`.
2. Heimgeist:
   - liest Event,
   - setzt `risk.level = 'critical'`,
   - erzeugt ein Insight:
     - `summary`: „CI-Failure auf main in <repo>“
     - `why`: „Branch main, erste Verteidigungslinie; Fehler in CI-Stage <…>.“
3. Heimgeist erzeugt Aktion:
   - `kind = 'run_wgx_guard'`
   - `target.repo = <repo>`
   - `autonomy_required = 2`
   - `status = 'pending'`.
4. Ausgabe:
   - Insight & Action als Dateien unter `heimgeist_state/…`
5. Leitstand kann diesen Zustand auslesen (später UI, erst mal CLI/JSON).

---

## 8. Nächste Ausbaustufen

1. **PR-Kontext dazunehmen**
   - `ci.result` mit `linked_pr` → Heimgeist kann Sichter-Aktionen vorschlagen:
     - `kind = 'trigger_sichter_quick'`.
2. **semantAH einbeziehen**
   - Beim Kontextaufbau ähnliche frühere Fehler suchen:
     - „Diese Fehlermeldung ist ähnlich zu Incident #7 und PR #42.“
3. **heimlern anschließen**
   - Risk-Assessment & Action-Vorschläge durch Lernlogik verbessern.

---

## 9. Betriebsoberfläche (v1 CLI)

Minimal-CLI-Kommandos für Heimgeist:

```bash
# Status-Überblick
heimgeist status

# Letzte Insights anzeigen
heimgeist insights --severity high

# Pending Actions
heimgeist actions --pending

# Einzelaktion genehmigen
heimgeist approve <action-id>

# Einzelaktion begründen
heimgeist why <insight-id>

# Analyse anfordern
heimgeist analyse --target all --depth quick
```

Diese Kommandos greifen auf die lokalen JSON-Dateien zu.
