#!/usr/bin/env python3
"""
Batch daily-fortune computation: read JSON from stdin, print per-entry daily
scores to stdout. No server. Used by Next.js via child_process.

Input (stdin):
  {
    "entries": [
      { "id": "abc", "birth_date": "1997-03-06", "birth_time": "03:25",
        "time_unknown": false, "gender": "male", "is_lunar": false,
        "is_leap_month": false, "utc_offset": 9,
        "yongshin_override": { "용신_오행": "水", "희신_오행": ["木"],
                                "기신_오행": ["火"], "구신_오행": [] } }
    ],
    "dates": ["2026-05-29", "2026-05-30", ..., "2026-06-04"]
  }

Output (stdout):
  {
    "abc": {
      "2026-06-04": { "score": 82, "grade": "길일(吉日)",
                       "seasonTag": "확장기", "seasonEmoji": "🚀",
                       "topDomain": "재물", "topDomainDelta": 12 },
      ...
    }
  }

`yongshin_override` is optional — when provided we reuse the same 용신 that the
stored chart used so daily scores stay consistent with the chart view.
"""
from __future__ import annotations

import io
import json
import sys
import warnings

from saju_lib import _load_engine, _parse_date, _parse_time


def _best_worst(domains: dict) -> tuple:
    """Return (bestKey, bestScore, worstKey, worstScore) over 0~100 domain scores."""
    if not domains:
        return ("", 0, "", 0)
    items = list(domains.items())
    best_k, best_v = max(items, key=lambda kv: kv[1])
    worst_k, worst_v = min(items, key=lambda kv: kv[1])
    return (best_k, int(best_v), worst_k, int(worst_v))


def _compute_entry(mod, entry: dict, dates: list) -> dict:
    BirthInput = getattr(mod, "BirthInput")
    compute_all = getattr(mod, "compute_all")
    build_daily_fortune = getattr(mod, "build_daily_fortune")

    birth_date = entry.get("birth_date")
    if not birth_date:
        raise ValueError("birth_date required")
    time_unknown = bool(entry.get("time_unknown", False))
    y, m, d = _parse_date(birth_date)
    hour, minute = (12, 0) if time_unknown else _parse_time(entry.get("birth_time", "12:00"))
    is_lunar = bool(entry.get("is_lunar", False))

    birth = BirthInput(
        year=y,
        month=m,
        day=d,
        hour=hour,
        minute=minute,
        calendar="lunar" if is_lunar else "solar",
        is_leap_month=bool(entry.get("is_leap_month", False)),
        gender="female" if entry.get("gender") == "female" else "male",
        city=entry.get("city", "Seoul"),
        use_solar_time=bool(entry.get("use_solar_time", True)),
        utc_offset=int(entry.get("utc_offset", 9)),
        early_zi_time=bool(entry.get("early_zi_time", False)),
    )

    r = compute_all(birth, yongshin_override=entry.get("yongshin_override"))

    out: dict = {}
    for date_str in dates:
        try:
            daily = build_daily_fortune(r, date_str)
        except Exception as e:  # noqa: BLE001 — one bad date shouldn't kill the entry
            sys.stderr.write(f"daily fail {entry.get('id')} {date_str}: {e}\n")
            continue
        season = daily.get("시즌태그") or {}
        domains = daily.get("운세도메인") or {}
        best_k, best_v, worst_k, worst_v = _best_worst(domains)
        out[date_str] = {
            "score": int(daily.get("점수", 0)),
            "grade": daily.get("등급", ""),
            "seasonTag": season.get("tag", ""),
            "seasonEmoji": season.get("emoji", ""),
            "domains": {k: int(v) for k, v in domains.items()},
            "bestDomain": best_k,
            "bestScore": best_v,
            "worstDomain": worst_k,
            "worstScore": worst_v,
        }
    return out


def main() -> None:
    try:
        raw = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"Invalid JSON: {e}\n")
        sys.exit(1)

    entries = raw.get("entries") or []
    dates = raw.get("dates") or []
    if not entries or not dates:
        sys.stdout.write("{}\n")
        return

    # Keep stdout clean: redirect stray prints/warnings to stderr.
    warnings.showwarning = lambda msg, *a, **kw: sys.stderr.write(f"Warning: {msg}\n")
    real_stdout = sys.stdout
    capture = io.StringIO()
    sys.stdout = capture
    try:
        mod = _load_engine()
        result: dict = {}
        for entry in entries:
            eid = entry.get("id")
            if not eid:
                continue
            try:
                result[eid] = _compute_entry(mod, entry, dates)
            except Exception as e:  # noqa: BLE001 — isolate per-entry failures
                sys.stderr.write(f"entry fail {eid}: {e}\n")
                result[eid] = {}
    finally:
        sys.stdout = real_stdout
        stray = capture.getvalue()
        if stray:
            sys.stderr.write(stray)

    real_stdout.write(json.dumps(result, ensure_ascii=False))
    real_stdout.write("\n")


if __name__ == "__main__":
    main()
