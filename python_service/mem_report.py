"""
Report this process's peak RSS to stderr for Railway correlation.

Linux ru_maxrss is KB; macOS ru_maxrss is bytes.
Line format (stable for Node/log scrapers):
  [python-mem] peakRssMb=123.4
"""
from __future__ import annotations

import atexit
import resource
import sys

_registered = False


def peak_rss_mb() -> float:
    ru = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if sys.platform == "darwin":
        return ru / (1024 * 1024)
    return ru / 1024


def log_peak_rss() -> None:
    try:
        sys.stderr.write(f"[python-mem] peakRssMb={peak_rss_mb():.1f}\n")
        sys.stderr.flush()
    except Exception:  # noqa: BLE001 — never fail the job for metrics
        pass


def register_atexit() -> None:
    """Idempotent: ensure peak RSS is logged when the process exits."""
    global _registered
    if _registered:
        return
    _registered = True
    atexit.register(log_peak_rss)
