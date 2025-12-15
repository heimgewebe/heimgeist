#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
heimgeist.sichter.kohärenz
=========================

Minimaler Kohärenz-Scanner für wc-merger JSON-Snapshots.
Er erzeugt einen Report, ohne ins Live-Repo zu schauen.

Philosophie: "Befund statt Befehl".
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


@dataclass
class Finding:
    severity: str  # info | warn | crit
    code: str
    title: str
    detail: str


@dataclass
class Report:
    generated_at: str
    agent: str
    input_path: str
    meta: Dict[str, Any]
    scope: str
    coverage_pct: Optional[float]
    files_total: Optional[int]
    findings: List[Finding]
    uncertainty: Dict[str, Any]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _safe_get(d: Dict[str, Any], *keys: str, default: Any = None) -> Any:
    cur: Any = d
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur


def _list_files(doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    files = doc.get("files")
    if isinstance(files, list):
        return [x for x in files if isinstance(x, dict)]
    return []


def _path_set(files: List[Dict[str, Any]]) -> set:
    out = set()
    for f in files:
        p = f.get("path")
        if isinstance(p, str):
            out.add(p)
    return out


def _count_duplicates(files: List[Dict[str, Any]]) -> List[str]:
    seen = set()
    dups = set()
    for f in files:
        p = f.get("path")
        if not isinstance(p, str):
            continue
        if p in seen:
            dups.add(p)
        seen.add(p)
    return sorted(dups)


def _heuristic_expected_markers(paths: set) -> List[Finding]:
    """
    Heimgewebe-typische Marker. Kein Muss – aber starke Signale.
    """
    findings: List[Finding] = []

    # Marker, die häufig Kohärenz stützen
    expected_any = [
        ".ai-context.yml",
        ".wgx/profile.yml",
        "contracts",
        "docs",
        ".github/workflows",
    ]

    # "Existiert als Datei?" vs "existiert als Ordner?"
    # Im wc-merge haben wir i.d.R. nur Datei-Pfade; Ordner sind indirekt.
    def has_prefix(prefix: str) -> bool:
        return any(p.startswith(prefix.rstrip("/") + "/") for p in paths)

    # .ai-context.yml
    if ".ai-context.yml" not in paths and not has_prefix(".ai-context.yml/"):
        findings.append(Finding(
            severity="warn",
            code="HG-SICHTER-001",
            title="Kein .ai-context.yml sichtbar",
            detail="Viele Heimgewebe-Repos nutzen .ai-context.yml als Orientierungsanker. Fehlt hier (oder wurde durch Filter ausgeschlossen).",
        ))

    # .wgx/
    if not has_prefix(".wgx/"):
        findings.append(Finding(
            severity="warn",
            code="HG-SICHTER-002",
            title="Kein .wgx/ sichtbar",
            detail="WGX-Motorik fehlt im Snapshot (oder wurde herausgefiltert). Falls das Repo zur Fleet gehört, ist das ein Drift-Signal.",
        ))

    # contracts/
    if not has_prefix("contracts/"):
        findings.append(Finding(
            severity="info",
            code="HG-SICHTER-003",
            title="Kein contracts/ sichtbar",
            detail="Nicht jedes Repo braucht Contracts. Für zentrale Repos kann das aber ein Hinweis auf semantische Entkopplung sein.",
        ))

    # docs/
    if not has_prefix("docs/") and not has_prefix("doc/"):
        findings.append(Finding(
            severity="info",
            code="HG-SICHTER-004",
            title="Keine docs/ sichtbar",
            detail="Dokumentation fehlt im Snapshot (oder wurde durch Filter ausgeschlossen). Das ist nicht per se falsch, aber erhöht Integrationsrisiko.",
        ))

    # workflows
    if not has_prefix(".github/workflows/"):
        findings.append(Finding(
            severity="info",
            code="HG-SICHTER-005",
            title="Keine GitHub Workflows sichtbar",
            detail="Kein CI sichtbar. Wenn das Repo produktiv ist, könnte das technische Schulden anzeigen – oder der Snapshot ist stark gefiltert.",
        ))

    return findings


def _meta_sanity(doc: Dict[str, Any], files: List[Dict[str, Any]]) -> List[Finding]:
    findings: List[Finding] = []

    contract = _safe_get(doc, "meta", "contract")
    ver = _safe_get(doc, "meta", "contract_version")
    profile = _safe_get(doc, "meta", "profile")
    coverage = _safe_get(doc, "coverage", "coverage_pct")
    max_file_bytes = _safe_get(doc, "meta", "max_file_bytes")
    scope = doc.get("scope")
    filters = doc.get("meta", {}).get("filters", {})

    if contract != "wc-merge-agent" or ver != "v1":
        findings.append(Finding(
            severity="crit",
            code="HG-SICHTER-010",
            title="Unerwarteter Merge-Contract",
            detail=f"Erwartet wc-merge-agent/v1, gefunden: {contract}/{ver}. Ergebnis ist nur eingeschränkt interpretierbar.",
        ))

    if isinstance(coverage, (int, float)) and coverage < 95.0:
        findings.append(Finding(
            severity="warn",
            code="HG-SICHTER-011",
            title="Coverage < 95%",
            detail=f"Coverage {coverage}%: Hohe Chance auf blinde Flecken. Befunde sind eher Tendenzen als Aussagen.",
        ))

    # max_file_bytes: 0 ist gut (keine Datei-Kürzung)
    if isinstance(max_file_bytes, int) and max_file_bytes not in (0,):
        findings.append(Finding(
            severity="warn",
            code="HG-SICHTER-012",
            title="Datei-Kürzung aktiv (max_file_bytes != 0)",
            detail=f"max_file_bytes={max_file_bytes}. Das ist semantisch riskant (Teilwahrheiten). Split wäre besser.",
        ))

    # Filter: path_filter/ext_filter -> können Marker verschwinden lassen
    path_filter = filters.get("path_filter") if isinstance(filters, dict) else None
    ext_filter = filters.get("ext_filter") if isinstance(filters, dict) else None
    if isinstance(path_filter, str) and path_filter.strip():
        findings.append(Finding(
            severity="info",
            code="HG-SICHTER-013",
            title="Path-Filter aktiv",
            detail=f"path_filter={path_filter!r}. Marker können fehlen, weil sie außerhalb des Scope liegen.",
        ))
    if isinstance(ext_filter, str) and ext_filter.strip():
        findings.append(Finding(
            severity="info",
            code="HG-SICHTER-014",
            title="Extension-Filter aktiv",
            detail=f"ext_filter={ext_filter!r}. Struktur-Befunde sind ggf. verzerrt.",
        ))

    # Duplicate paths
    dups = _count_duplicates(files)
    if dups:
        findings.append(Finding(
            severity="crit",
            code="HG-SICHTER-015",
            title="Doppelte Dateipfade im Merge",
            detail="Folgende Pfade sind mehrfach enthalten: " + ", ".join(dups[:50]) + (" …" if len(dups) > 50 else ""),
        ))

    # Profile hint
    if isinstance(profile, str) and profile.lower() in ("dev", "min"):
        findings.append(Finding(
            severity="info",
            code="HG-SICHTER-016",
            title="Profil ist nicht maximal",
            detail=f"profile={profile!r}. Für Kohärenz-Checks ist max oft sinnvoller (weniger blinde Flecken).",
        ))

    if not isinstance(scope, str) or not scope.strip():
        findings.append(Finding(
            severity="warn",
            code="HG-SICHTER-017",
            title="Scope nicht angegeben",
            detail="scope fehlt/leer. Mehrdeutigkeit steigt: Ist es ein Single-Repo- oder Multi-Repo-Snapshot?",
        ))

    return findings


def _uncertainty(doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sichtbar gemachte Ungewissheit + Ursachen.
    """
    coverage = _safe_get(doc, "coverage", "coverage_pct")
    filters = _safe_get(doc, "meta", "filters", default={})
    plan_only = _safe_get(doc, "meta", "plan_only")
    code_only = _safe_get(doc, "meta", "code_only")

    causes: List[str] = []
    score = 0.18  # Baseline

    if isinstance(coverage, (int, float)) and coverage < 100.0:
        score += 0.10
        causes.append("Coverage < 100%: Snapshot ist unvollständig (blinde Flecken).")

    if isinstance(filters, dict) and (filters.get("path_filter") or filters.get("ext_filter")):
        score += 0.08
        causes.append("Filter aktiv: Struktur-Befunde können verzerrt sein.")

    if plan_only is True or code_only is True:
        score += 0.12
        causes.append("plan_only/code_only: Semantischer Kontext fehlt teilweise.")

    score = max(0.0, min(0.95, score))

    return {
        "uncertainty_score": score,
        "causes": causes or ["Keine dominanten Ungewissheits-Treiber erkannt (aber Snapshot bleibt Snapshot)."],
        "note": "Ungewissheit ist hier produktiv: Sie verhindert, dass Snapshot-Befunde als Live-Wahrheit missverstanden werden.",
    }


def build_report(doc: Dict[str, Any], input_path: Path) -> Report:
    files = _list_files(doc)
    paths = _path_set(files)

    meta = doc.get("meta") if isinstance(doc.get("meta"), dict) else {}
    scope = doc.get("scope") if isinstance(doc.get("scope"), str) else ""
    coverage = _safe_get(doc, "coverage", "coverage_pct")
    files_total = _safe_get(doc, "meta", "total_files")

    findings: List[Finding] = []
    findings.extend(_meta_sanity(doc, files))
    findings.extend(_heuristic_expected_markers(paths))

    return Report(
        generated_at=_now_iso(),
        agent="heimgeist.sichter.kohärenz",
        input_path=str(input_path),
        meta=meta,
        scope=scope,
        coverage_pct=coverage if isinstance(coverage, (int, float)) else None,
        files_total=files_total if isinstance(files_total, int) else None,
        findings=findings,
        uncertainty=_uncertainty(doc),
    )


def render_markdown(rep: Report) -> str:
    lines: List[str] = []
    lines.append(f"# {rep.agent}")
    lines.append("")
    lines.append(f"- generated_at: `{rep.generated_at}`")
    lines.append(f"- input: `{rep.input_path}`")
    if rep.scope:
        lines.append(f"- scope: `{rep.scope}`")
    if rep.coverage_pct is not None:
        lines.append(f"- coverage_pct: `{rep.coverage_pct}`")
    if rep.files_total is not None:
        lines.append(f"- total_files(meta): `{rep.files_total}`")
    lines.append("")

    # Findings
    def bucket(sev: str) -> List[Finding]:
        return [f for f in rep.findings if f.severity == sev]

    for sev, title in [("crit", "Kritisch"), ("warn", "Warnungen"), ("info", "Hinweise")]:
        fs = bucket(sev)
        lines.append(f"## {title} ({len(fs)})")
        if not fs:
            lines.append("_Keine._")
            lines.append("")
            continue
        for f in fs:
            lines.append(f"- **{f.code}** — {f.title}")
            lines.append(f"  - {f.detail}")
        lines.append("")

    # Uncertainty
    lines.append("## Ungewissheit")
    lines.append(f"- score: `{rep.uncertainty.get('uncertainty_score')}`")
    lines.append("- Ursachen:")
    for c in rep.uncertainty.get("causes", []):
        lines.append(f"  - {c}")
    lines.append(f"- Notiz: {rep.uncertainty.get('note')}")
    lines.append("")

    # Essenz + ironischer Stachel
    lines.append("## Verdichtete Essenz")
    lines.append("Snapshot-Befunde sind Landkarten, keine Gerichtsakten.")
    lines.append("")
    lines.append("## Ironischer Nachsatz")
    lines.append("Wenn alles perfekt kohärent wäre, bräuchten wir den Sichter nicht – und dann wäre Heimgewebe vermutlich tot. Glückwunsch zur lebendigen Unordnung.")
    lines.append("")

    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("merge_json", help="Pfad zum wc-merger JSON")
    ap.add_argument("--out", default="reports/heimgeist.sichter", help="Ausgabeordner")
    ap.add_argument("--json", action="store_true", help="Zusätzlich JSON-Befund schreiben")
    args = ap.parse_args()

    in_path = Path(args.merge_json).expanduser().resolve()
    out_dir = Path(args.out).expanduser()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not in_path.exists():
        raise SystemExit(f"Input nicht gefunden: {in_path}")

    doc = _load_json(in_path)
    rep = build_report(doc, in_path)

    stem = in_path.stem
    md_path = out_dir / f"{stem}__heimgeist.sichter.kohärenz.md"
    md_path.write_text(render_markdown(rep), encoding="utf-8")

    if args.json:
        js_path = out_dir / f"{stem}__heimgeist.sichter.kohärenz.json"
        js_path.write_text(json.dumps(asdict(rep), ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote: {md_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
