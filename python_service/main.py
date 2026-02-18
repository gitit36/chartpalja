"""
FastAPI service for Saju computation.
Uses saju_lib (saju_engine.py + shinsal_lookup.csv) for computation.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from saju_lib import compute_report

app = FastAPI(title="Saju Python Service", version="2.0.0")


class SajuReportRequest(BaseModel):
    birth_date: str = Field(..., description="YYYY-MM-DD")
    birth_time: str = Field(default="12:00", description="HH:MM")
    time_unknown: bool = Field(default=False)
    gender: str = Field(default="male", pattern="^(male|female)$")
    is_lunar: bool = Field(default=False)
    is_leap_month: bool = Field(default=False)
    city: str | None = Field(default="Seoul")
    utc_offset: int = Field(default=9, ge=-12, le=14)
    use_solar_time: bool = Field(default=True)
    early_zi_time: bool = Field(default=True)
    redact: bool = Field(default=True, description="Strip birth_date/birth_time from output")


@app.post("/saju/report")
def saju_report(req: SajuReportRequest) -> dict:
    """Compute Saju report via saju_engine. Returns normalized JSON."""
    try:
        report = compute_report(
            birth_date=req.birth_date,
            birth_time=req.birth_time,
            time_unknown=req.time_unknown,
            gender=req.gender,
            city=req.city or "Seoul",
            utc_offset=req.utc_offset,
            use_solar_time=req.use_solar_time,
            early_zi_time=req.early_zi_time,
            redact=req.redact,
        )
        return report
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail="Saju computation failed") from e


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/saju/verify")
def verify() -> dict:
    """Verification: 1997-03-06 03:25 male, solar. Returns four pillars."""
    report = compute_report(
        birth_date="1997-03-06",
        birth_time="03:25",
        time_unknown=False,
        gender="male",
        redact=False,
    )
    pillars = report.get("만세력_사주원국") or {}
    return {
        "birth": "1997-03-06 03:25",
        "gender": "male",
        "solar": True,
        "만세력_사주원국": pillars,
        "연주": pillars.get("연주"),
        "월주": pillars.get("월주"),
        "일주": pillars.get("일주"),
        "시주": pillars.get("시주"),
    }
