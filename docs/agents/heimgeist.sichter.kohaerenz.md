# heimgeist.sichter.kohärenz

## Zweck
Dieser Agent produziert **Kohärenz-Befunde** aus **repoLens** Snapshots (JSON).
Er ist bewusst **kein Patch-Agent**.

Er beantwortet nur:
- Was passt zusammen?
- Was widerspricht sich?
- Wo droht Drift?

## Input
- repoLens JSON Snapshot (`repolens-agent`, v1; spec 2.4)

Hinweis: Snapshots können **multi-repo** sein. Dann werden Findings pro Repo getrennt ausgewiesen.

## Output
- Markdown-Report (menschenlesbar)
- JSON-Befund (maschinenlesbar)

## Prinzipien
1. Snapshot ≠ Live-Repo
2. Beobachtung strikt getrennt von Interpretation
3. Kein "Mach das so", sondern "Das ist die Spannung"

## Heuristiken (aktuell)
- Struktur-Hinweise (pro Repo):
  - `.ai-context.yml` oder `ai-context.yml`
  - `.wgx/` (z.B. `.wgx/profile.yml`)
  - `contracts/`
  - `docs/`
  - `.github/workflows/`
- Meta-Checks:
  - Contract/Version/Spec
  - Coverage & Filter (Content/Path/Ext)
- Drift-Checks:
  - Stark gefilterte Snapshots (code-only / low coverage)
  - Duplicate Pfade **innerhalb desselben Repo**

## Grenzen
- Kein GitHub-Live-Zugriff
- Keine Commit-Historie
- Keine automatische Reparatur

## Aufruf (lokal)
```sh
python3 scripts/heimgeist_sichter_kohaerenz.py /path/to/repolens.json --out reports/heimgeist.sichter --json
```

## CI-Nutzung (GitHub Actions)
- Workflow: `.github/workflows/heimgeist-sichter-kohaerenz.yml`
- Standard: Report als Artifact
- Optional: Commit des Reports via `commit_report=true` (bewusstes Risiko)
