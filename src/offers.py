from __future__ import annotations

from dataclasses import dataclass

from lead_model import Lead


@dataclass
class OfferRecommendation:
    offer_name: str
    pitch_angle: str
    roi_reason: str


def recommend_offer(lead: Lead) -> OfferRecommendation:
    text = " ".join(
        [
            lead.industry.lower(),
            lead.recent_signal.lower(),
            lead.hiring_signal.lower(),
            lead.tech_stack.lower(),
            lead.pain_notes.lower(),
        ]
    )

    if any(keyword in text for keyword in ("inbound", "routing", "crm", "lead", "sales")):
        return OfferRecommendation(
            offer_name="Lead Response Engine",
            pitch_angle="Qualify, route, and respond to valuable leads before they go cold.",
            roi_reason="Cuts response delays and improves pipeline conversion without adding headcount.",
        )

    if any(keyword in text for keyword in ("intake", "case", "consultation", "form", "client")):
        return OfferRecommendation(
            offer_name="Client Intake Engine",
            pitch_angle="Turn messy intake into a structured, AI-assisted workflow.",
            roi_reason="Reduces admin handling time and prevents incomplete or slow intake follow-up.",
        )

    if any(keyword in text for keyword in ("content", "linkedin", "founder", "loom", "social")):
        return OfferRecommendation(
            offer_name="Founder Content Engine",
            pitch_angle="Convert founder insight into a repeatable weekly content machine.",
            roi_reason="Replaces inconsistent posting with a structured system that compounds credibility.",
        )

    if any(keyword in text for keyword in ("support", "complaint", "renewal", "churn", "customer")):
        return OfferRecommendation(
            offer_name="Churn Alert Engine",
            pitch_angle="Detect renewal risk and client dissatisfaction before revenue walks out.",
            roi_reason="Saving even one high-value client can cover the implementation cost quickly.",
        )

    return OfferRecommendation(
        offer_name="Ops Bridge Engine",
        pitch_angle="Connect fragmented tools so operations stop leaking time through manual work.",
        roi_reason="Eliminates repetitive handoffs and reduces spreadsheet-driven operational drag.",
    )
