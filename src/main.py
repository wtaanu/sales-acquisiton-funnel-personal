from __future__ import annotations

import argparse
from pathlib import Path

from io_utils import load_leads, write_ranked_leads
from offers import recommend_offer
from outreach import build_cta, build_email_body, build_loom_angle, build_subject_line
from scoring import score_lead


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Rank leads and generate demo offers.")
    parser.add_argument(
        "--input",
        default="data/sample_leads.csv",
        help="Input CSV path containing raw leads.",
    )
    parser.add_argument(
        "--output",
        default="output/ranked_leads.csv",
        help="Output CSV path for ranked leads.",
    )
    return parser


def make_brief(company_name: str, buyer_title: str, offer_name: str, pitch_angle: str) -> str:
    return (
        f"{company_name}: pitch the {offer_name} to the {buyer_title}. "
        f"Primary angle: {pitch_angle}"
    )


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    leads = load_leads(input_path)
    ranked_rows: list[dict[str, str | int]] = []

    for lead in leads:
        score = score_lead(lead)
        offer = recommend_offer(lead)
        ranked_rows.append(
            {
                "company_name": lead.company_name,
                "buyer_name": lead.buyer_name,
                "country": lead.country,
                "industry": lead.industry,
                "employee_count": lead.employee_count,
                "email": lead.email,
                "buyer_title": lead.buyer_title,
                "recommended_offer": offer.offer_name,
                "pitch_angle": offer.pitch_angle,
                "roi_reason": offer.roi_reason,
                "lead_score": score.total,
                "budget_score": score.budget_score,
                "urgency_score": score.urgency_score,
                "fit_score": score.fit_score,
                "buyer_score": score.buyer_score,
                "brief": make_brief(
                    lead.company_name,
                    lead.buyer_title,
                    offer.offer_name,
                    offer.pitch_angle,
                ),
                "subject_line": build_subject_line(lead, offer),
                "email_body": build_email_body(lead, offer),
                "loom_angle": build_loom_angle(lead, offer),
                "cta": build_cta(),
                "verification_status": "pending",
                "website": lead.website,
            }
        )

    ranked_rows.sort(key=lambda item: int(item["lead_score"]), reverse=True)
    write_ranked_leads(output_path, ranked_rows)
    print(f"Wrote {len(ranked_rows)} ranked leads to {output_path}")


if __name__ == "__main__":
    main()
