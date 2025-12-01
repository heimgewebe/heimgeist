# Plexer Integration

Heimgeist ist der Meta-Agent im Heimgewebe-Organismus.
Plexer ist das Ereignisnetz (Event Router), das Heimgeist mit Events versorgt.

Dieses Dokument beschreibt die Beziehung der beiden Komponenten.

## Rolle von Plexer

Plexer:

- nimmt Events von Repos und Diensten entgegen (`POST /events`)
- prüft eine Minimalstruktur (`type`, `source`, `payload`)
- loggt und normalisiert Events
- leitet Events an Heimgeist (und später weitere Konsumenten) weiter

Plexer ist damit Teil des **Eventkanals** (Nervensystem) des Organismus.

## Rolle von Heimgeist

Heimgeist:

- interpretiert Events (Risiko, Muster, Epics, Empfehlungen)
- lernt aus Ereignisverläufen
- erzeugt Aktionen, Hinweise und Konfigurationsempfehlungen

Heimgeist verlässt sich darauf, dass Plexer Events bereits transportiert
und in eine einheitliche Form gebracht hat.

## Trennung von Events und Kommandos

Heimgeist arbeitet mit zwei verschiedenen Informationsarten:

1. **Events** – Fakten darüber, was im System passiert ist
   (CI-Ergebnisse, Deployments, Incidents, Monitoring-Signale …)

2. **Kommandos** – Absichten, was als Nächstes passieren soll
   (z. B. `@heimgewebe/sichter /quick`, `@heimgewebe/wgx /guard changed`,
   `@heimgewebe/metarepo /link-epic EPIC-123`)

Diese beiden Kanäle sind bewusst getrennt:

- Events kommen über **Plexer** zu Heimgeist.
- Kommandos kommen direkt aus GitHub PR-Kommentaren über den Dispatcher.

Plexer ist **kein** Kommando-Router und verarbeitet keine PR-Kommentare.

## Konsequenzen für Integrationen

- Neue Fehlermeldungen, CI-Ergebnisse, Deployment-Statusmeldungen etc.
  sollten als Events an Plexer gesendet werden.

- Neue PR-Kommandos sollten weiterhin als GitHub-Kommentare implementiert
  werden und über den bestehenden Kommando-Parser laufen.

- Änderungen an der Nachrichtentopologie (z. B. Kommandos über Plexer
  leiten) erfordern eine Aktualisierung von ADR-0021 im Metarepo.

## Kurzfassung

- Plexer: Transport und Distribution von Events.
- Heimgeist: Interpretation von Events und Reaktion darauf.
- GitHub-Kommentare: Interaktive Kommandoebene für Tools.

Der Organismus behält damit ein klares Nervensystem, ohne dass
die Kommandoebene mit dem Eventtransport vermischt wird.
