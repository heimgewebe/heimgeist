# Heimgeist — historische Referenz

> **Status: dekommissioniert.** Dieses Repository wird nicht mehr als aktiver Meta-Agent oder Produktionsbestandteil des Heimgewebe-Ökosystems weiterentwickelt. Es bleibt als historische Architektur-, Implementierungs- und Contract-Referenz erhalten und ist für die GitHub-Archivierung vorbereitet.

## Warum Heimgeist stillgelegt wurde

Heimgeist entstand als **System Self-Reflection Engine**: ein eventgetriebener Meta-Agent mit den Rollen Observer, Critic, Director und Archivist. Diese Idee war für die Entwicklung des Heimgewebe-Ökosystems nützlich, ihre operativen Verantwortlichkeiten sind inzwischen jedoch auf klarer abgegrenzte Systeme verteilt.

Die aktuelle Verantwortungsaufteilung lautet insbesondere:

- **Grabowski**: lokale Operator-Ausführung und Agent-Routing;
- **Bureau**: Tasks, Claims und Completion-Lifecycle;
- **Chronik**: append-only Ereignis- und Verlaufshistorie;
- **Systemkatalog**: stabile Ökosystem-Semantik, Zwecke und Zuständigkeiten;
- **RepoGround**: verifizierbarer, zitierbarer Repository-Kontext;
- **Plexer**: begrenzter Eventtransport mit Chronik als kritischer Senke;
- **Leitstand**: read-only Beobachtung und Statusprojektion.

Heimgeist besitzt damit **keine aktuelle Truth-Ownership, Produktionsautorität oder notwendige Runtime-Rolle** mehr.

## Cutover 2026-08-31

Vor der Stilllegung wurden die verbliebenen aktiven Integrationskanten geschlossen:

1. `heimgewebe/plexer#104` entfernte Heimgeist aus dem Live-Fanout. `HEIMGEIST_URL` und `HEIMGEIST_TOKEN` bleiben dort nur parse-kompatibel und können den Consumer nicht mehr aktivieren.
2. Metarepo entfernt Heimgeist aus der aktiven Command-Dispatch-Autorität und klassifiziert `heimgeist.insight` als historischen Eventvertrag. Das Schema bleibt zur Interpretation alter Chronik-Einträge und Fixtures erhalten.
3. Dieses Repository entfernt seine eigene PR-Command-Dispatch-Oberfläche und deaktiviert Renovate, damit keine neue Produktentwicklung oder Abhängigkeitspflege mehr suggeriert wird.

## Was hier weiterhin wertvoll ist

Der Quellstand bleibt absichtlich erhalten. Besonders relevant für historische oder konzeptionelle Recherche sind:

- `docs/heimgeist-core-loop.md` — minimaler eventgetriebener Reflexionsloop;
- `docs/heimgeist-meta-agent.md` — Rollenmodell Observer/Critic/Director/Archivist;
- `docs/heimgewebe-organismus.md` — frühere Organismus-Metapher und Zielbilder;
- `docs/pipeline-usage.md` — frühere Command-/Event-Pipeline;
- `src/core/` — konkrete TypeScript-Implementierung des Meta-Agent-Kerns;
- `src/api/` und `src/cli/` — historische HTTP-/CLI-Oberflächen;
- Tests und Contracts — Belege für den letzten implementierten Zustand.

Diese Inhalte sind **Dokumentation der Entwicklungsgeschichte**, nicht Beschreibung der heutigen Systemautorität.

## Regeln für diese Referenz

- Keine neuen Features.
- Keine neue Runtime oder Deployment-Autorität.
- Keine Wiederbelebung alter Plexer-, WGX-, Sichter- oder Command-Dispatch-Kanten.
- Historische Schemas und Dokumente dürfen zur Nachvollziehbarkeit erhalten bleiben.
- Erkenntnisse, die für das heutige System noch relevant sind, gehören in den jeweils zuständigen aktiven Primärort statt zurück nach Heimgeist.

## Reaktivierung

Eine Reaktivierung sollte **nicht** durch Entarchivieren und Weiterbauen erfolgen. Falls künftig wieder ein Bedarf für systemweite Reflexion entsteht, ist zuerst zu prüfen, welche heutige Komponente diese Funktion besitzen sollte und welcher neue, klar begrenzte Contract dafür nötig ist. Erst danach wäre eine neue Implementierung sinnvoll.

## Letzter aktiver Quellstand

Der Freeze basiert auf `main` nach `adaa352a18fd2396c04fb906d7f085717f62964f` vom 31. August 2026. Der vollständige Git-Verlauf bleibt die maßgebliche historische Quelle.

## Lizenz

MIT
