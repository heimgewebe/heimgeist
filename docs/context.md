# Heimgeist Kontext

Heimgeist ist der systemweite Meta-Agent, der sämtliche Repos des
Heimgewebes beobachtet, Risiken erkennt, Drift identifiziert und
Reflexionsprozesse anstößt.

Er nutzt:

- chronik → Events
- semantAH → semantische Einordnung
- sichter → Analyse und Muster
- wgx → Guard/Smoke
- hausKI → orchestrierte Aktionen

## Heimplex als Event-Eintrittspunkt

Events sollten Heimgeist nicht mehr direkt aus Workflows erreichen,
sondern über Heimplex:

- Heimplex nimmt Events von allen Repos entgegen
- prüft Minimalstruktur (type, source, payload)
- loggt und routet die Events an Heimgeist weiter

Heimgeist bleibt damit fokussiert auf:

- Interpretation (Risiko, Muster, Empfehlungen)
- Lernen aus Ereignissen über Zeit

und überlässt Heimplex den Transport.
