# plexer Kontext

Heimgeist ist der systemweite Meta-Agent, der sämtliche Repos des
Heimgewebes beobachtet, Risiken erkennt, Drift identifiziert und
Reflexionsprozesse anstößt.

Er nutzt:

- chronik → Events
- semantAH → semantische Einordnung
- sichter → Analyse und Muster
- wgx → Guard/Smoke
- hausKI → orchestrierte Aktionen

## plexer als Event-Eintrittspunkt

Events sollten Heimgeist primär nicht mehr direkt aus Workflows erreichen,
sondern über plexer:

- plexer nimmt Events von allen Repos entgegen
- prüft Minimalstruktur (type, source, payload)
- loggt und routet die Events an Heimgeist weiter

Heimgeist bleibt damit fokussiert auf:

- Interpretation (Risiko, Muster, Empfehlungen)
- Lernen aus Ereignissen über Zeit

und überlässt plexer den Transport.
