from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Lead:
    company_name: str
    country: str
    industry: str
    employee_count: int
    funding_stage: str
    recent_signal: str
    hiring_signal: str
    tech_stack: str
    pain_notes: str
    buyer_name: str
    buyer_title: str
    email: str
    website: str

    @classmethod
    def from_row(cls, row: dict[str, str]) -> "Lead":
        employee_count_raw = row.get("employee_count", "0").strip() or "0"
        return cls(
            company_name=row.get("company_name", "").strip(),
            country=row.get("country", "").strip(),
            industry=row.get("industry", "").strip(),
            employee_count=int(employee_count_raw),
            funding_stage=row.get("funding_stage", "").strip(),
            recent_signal=row.get("recent_signal", "").strip(),
            hiring_signal=row.get("hiring_signal", "").strip(),
            tech_stack=row.get("tech_stack", "").strip(),
            pain_notes=row.get("pain_notes", "").strip(),
            buyer_name=row.get("buyer_name", "").strip(),
            buyer_title=row.get("buyer_title", "").strip(),
            email=row.get("email", "").strip(),
            website=row.get("website", "").strip(),
        )
