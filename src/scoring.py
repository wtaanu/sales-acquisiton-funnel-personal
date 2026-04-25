from __future__ import annotations

from dataclasses import dataclass

from lead_model import Lead


@dataclass
class LeadScore:
    total: int
    budget_score: int
    urgency_score: int
    fit_score: int
    buyer_score: int


def score_lead(lead: Lead) -> LeadScore:
    budget_score = score_budget(lead)
    urgency_score = score_urgency(lead)
    fit_score = score_fit(lead)
    buyer_score = score_buyer(lead)
    total = budget_score + urgency_score + fit_score + buyer_score
    return LeadScore(
        total=total,
        budget_score=budget_score,
        urgency_score=urgency_score,
        fit_score=fit_score,
        buyer_score=buyer_score,
    )


def score_budget(lead: Lead) -> int:
    score = 0

    if lead.country.lower() in {"united states", "usa", "us", "united kingdom", "uk"}:
        score += 15
    if 15 <= lead.employee_count <= 60:
        score += 20
    elif 8 <= lead.employee_count < 15 or 61 <= lead.employee_count <= 100:
        score += 10
    if lead.funding_stage.lower() in {"seed", "series a", "series b", "private"}:
        score += 15

    return score


def score_urgency(lead: Lead) -> int:
    text = f"{lead.recent_signal} {lead.hiring_signal}".lower()
    score = 0

    if any(keyword in text for keyword in ("funding", "raised", "growth", "expanding")):
        score += 15
    if any(keyword in text for keyword in ("sales ops", "revops", "operations", "customer success", "marketing ops")):
        score += 15
    if any(keyword in text for keyword in ("hiring", "job post", "opening")):
        score += 10

    return score


def score_fit(lead: Lead) -> int:
    text = f"{lead.industry} {lead.tech_stack} {lead.pain_notes}".lower()
    score = 0

    if any(keyword in text for keyword in ("saas", "law", "legal", "real estate")):
        score += 10
    if any(keyword in text for keyword in ("hubspot", "salesforce", "slack", "whatsapp", "crm", "zapier")):
        score += 15
    if any(keyword in text for keyword in ("manual", "slow", "spreadsheet", "handoff", "inbound", "intake", "follow-up")):
        score += 20

    return score


def score_buyer(lead: Lead) -> int:
    title = lead.buyer_title.lower()
    if any(keyword in title for keyword in ("ceo", "founder", "coo", "cro", "cto", "head")):
        return 15
    if any(keyword in title for keyword in ("director", "manager", "lead")):
        return 8
    return 0
