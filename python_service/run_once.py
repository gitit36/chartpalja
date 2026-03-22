#!/usr/bin/env python3
"""
One-off Saju computation: read JSON from stdin, print normalized report JSON to stdout.
No server. Used by Next.js via child_process.

  echo '{"birth_date":"1997-03-06","birth_time":"03:25","gender":"male"}' | python run_once.py
"""
from __future__ import annotations

import io
import json
import sys
import warnings

from saju_lib import compute_report


def main() -> None:
    try:
        raw = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"Invalid JSON: {e}\n")
        sys.exit(1)
    birth_date = raw.get("birth_date")
    if not birth_date:
        sys.stderr.write("birth_date required\n")
        sys.exit(1)

    # Redirect any stray print()/warnings from libraries to stderr
    # so stdout stays clean JSON for the Node.js caller.
    warnings.showwarning = lambda msg, *a, **kw: sys.stderr.write(f"Warning: {msg}\n")
    real_stdout = sys.stdout
    capture = io.StringIO()
    sys.stdout = capture
    try:
        result = compute_report(
            birth_date=birth_date,
            birth_time=raw.get("birth_time", "12:00"),
            time_unknown=bool(raw.get("time_unknown", False)),
            gender="female" if raw.get("gender") == "female" else "male",
            city=raw.get("city", "Seoul"),
            utc_offset=int(raw.get("utc_offset", 9)),
            use_solar_time=bool(raw.get("use_solar_time", True)),
            early_zi_time=bool(raw.get("early_zi_time", True)),
            is_lunar=bool(raw.get("is_lunar", False)),
            is_leap_month=bool(raw.get("is_leap_month", False)),
            redact=True,
            yongshin_override=raw.get("yongshin_override"),
        )
    finally:
        sys.stdout = real_stdout
        stray = capture.getvalue()
        if stray:
            sys.stderr.write(stray)

    real_stdout.write(json.dumps(result, ensure_ascii=False))
    real_stdout.write("\n")


if __name__ == "__main__":
    main()
