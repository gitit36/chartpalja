# -*- coding: utf-8 -*-
"""월·일 사건 라벨 로더 (연도 life_events와 독립)."""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Tuple

_HERE = os.path.dirname(os.path.abspath(__file__))
LABELS_PATH = os.path.join(_HERE, "month_day_labels.json")

_CONF_OK = frozenset({"high", "medium"})


def load_raw(path: str = LABELS_PATH) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _norm_event(e: dict, *, need_day: bool) -> Optional[dict]:
    if e.get("year") is None or e.get("month") is None:
        return None
    conf = str(e.get("confidence", "medium")).strip().lower()
    if conf not in ("high", "medium", "low"):
        conf = "medium"
    if conf == "low":
        return None
    if bool(e.get("exclude_from_validation")):
        return None
    month = int(e["month"])
    if month < 1 or month > 12:
        return None
    day = e.get("day")
    if need_day:
        if day is None:
            return None
        day = int(day)
        if day < 1 or day > 31:
            return None
    else:
        day = int(day) if day is not None else None
    return {
        "year": int(e["year"]),
        "month": month,
        "day": day,
        "weight": float(e.get("weight", 1.0)),
        "label": e.get("label") or "",
        "confidence": conf,
        "source": e.get("source"),
    }


def events_for(
    name: str,
    *,
    need_day: bool = False,
    path: str = LABELS_PATH,
) -> Tuple[List[dict], List[dict]]:
    raw = load_raw(path)
    block = (raw.get("subjects") or {}).get(name) or {}
    good = []
    bad = []
    for e in block.get("good") or []:
        n = _norm_event(e, need_day=need_day)
        if n:
            good.append(n)
    for e in block.get("bad") or []:
        n = _norm_event(e, need_day=need_day)
        if n:
            bad.append(n)
    return good, bad


def coverage_report(names: List[str], *, need_day: bool = False) -> Dict[str, Any]:
    rows = []
    for name in names:
        g, b = events_for(name, need_day=need_day)
        rows.append({
            "name": name,
            "good": len(g),
            "bad": len(b),
            "evalable": len(g) >= 2 and len(b) >= 2,
        })
    return {
        "need_day": need_day,
        "n_subjects": len(rows),
        "evalable": sum(1 for r in rows if r["evalable"]),
        "rows": rows,
    }
