# heimgeist.sichter.kohärenz

## Zweck
Dieser Agent produziert **Kohärenz-Befunde** aus wc-merger Snapshots (JSON).
Er ist bewusst **kein Patch-Agent**.

Er beantwortet nur:
- Was passt zusammen?
- Was widerspricht sich?
- Wo droht Drift?

## Input
- wc-merger JSON (`wc-merge-agent`, v1)

## Output
- Markdown-Report (menschenlesbar)
- optional JSON-Befund (maschinenlesbar)

## Prinzipien
1. Snapshot ≠ Live-Repo
2. Beobachtung strikt getrennt von Interpretation
3. Kein "Mach das so", sondern "Das ist die Spannung"

## Heuristiken (aktuell)
- Struktur-Hinweise: `.ai-context.yml`, `.wgx/`, `contracts/`, `docs/`
- Meta-Checks: Coverage, Profile, Filter
- Drift-Checks: ungewöhnliche Scope/Filter-Kombinationen (z.B. nur Teilpfade)

## Grenzen
- Kein GitHub-Live-Zugriff
- Keine Commit-Historie
- Keine automatische Reparatur

## Aufruf (lokal)
```sh
python3 scripts/heimgeist_sichter_kohärenz.py /path/to/wc-merge.json --out reports/heimgeist.sichter
```
