from __future__ import annotations

from lead_model import Lead
from offers import OfferRecommendation


def build_subject_line(lead: Lead, offer: OfferRecommendation) -> str:
    if offer.offer_name == "Lead Response Engine":
        return f"Possible lead leak at {lead.company_name}"
    if offer.offer_name == "Client Intake Engine":
        return f"{lead.company_name}'s intake process may be slowing growth"
    if offer.offer_name == "Founder Content Engine":
        return f"A simpler content engine for {lead.company_name}"
    if offer.offer_name == "Churn Alert Engine":
        return f"Early churn warning system for {lead.company_name}"
    return f"Operational bottleneck at {lead.company_name}"


def build_email_body(lead: Lead, offer: OfferRecommendation) -> str:
    return (
        f"Hi {lead.buyer_name or lead.buyer_title},\n\n"
        f"I was reviewing {lead.company_name} and noticed signals around {lead.recent_signal.lower()}. "
        f"Teams at this stage usually start losing time and revenue in manual workflows.\n\n"
        f"Based on your setup with {lead.tech_stack}, I would look first at a {offer.offer_name}. "
        f"{offer.pitch_angle} {offer.roi_reason}\n\n"
        f"If useful, I can map a simple 2-minute system outline tailored to {lead.company_name}.\n\n"
        f"Warm regards,\n"
        f"[Your Name]\n"
        f"Anutech Labs"
    )


def build_loom_angle(lead: Lead, offer: OfferRecommendation) -> str:
    return (
        f"Show the current workflow bottleneck at {lead.company_name}, then show how the "
        f"{offer.offer_name} removes manual steps and speeds up execution."
    )


def build_cta() -> str:
    return "Worth a quick 10-minute conversation if I map the system around your current workflow?"
