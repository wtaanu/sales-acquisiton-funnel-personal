import { config } from "../config.js";
import { rawLeadColumns, scoredLeadColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";
import { logInfo } from "../lib/logger.js";
import { nowIso } from "../lib/time.js";
import { recommendOffer } from "../services/offer-recommendation.js";
import { scoreLead } from "../services/scoring.js";

export async function runScoreLeadsJob() {
  const rawRows = await readSheet(config.sheetTabs.rawLeads);
  const existingScoredRows = await readSheet(config.sheetTabs.scoredLeads);
  const scoredByLeadId = new Map(
    existingScoredRows.filter((row) => row.lead_id).map((row) => [row.lead_id, row])
  );
  const scorableRows = rawRows.filter((row) => row.raw_status === "ready_for_scoring");
  const timestamp = nowIso();

  let updatedCount = 0;
  let createdCount = 0;

  for (const row of scorableRows) {
    const score = scoreLead(row);
    const offer = recommendOffer(row);
    const normalized = {
      lead_id: row.lead_id,
      company_name: row.company_name,
      buyer_name: row.buyer_name,
      buyer_title: row.buyer_title,
      email: row.email,
      country: row.country,
      industry: row.industry,
      employee_count: row.employee_count,
      recommended_offer: offer.recommended_offer,
      pitch_angle: offer.pitch_angle,
      roi_reason: offer.roi_reason,
      lead_score: score.lead_score,
      budget_score: score.budget_score,
      urgency_score: score.urgency_score,
      fit_score: score.fit_score,
      buyer_score: score.buyer_score,
      qualification_notes: [score.qualification_notes, `Primary pitch: ${offer.recommended_offer}`]
        .filter(Boolean)
        .join(" "),
      verification_status: "pending",
      verification_sub_status: "pending",
      verification_checked_at: "",
      verification_notes: "",
      website: row.website,
      scored_at: timestamp
    };
    if (scoredByLeadId.has(row.lead_id)) {
      scoredByLeadId.set(row.lead_id, {
        ...scoredByLeadId.get(row.lead_id),
        ...normalized
      });
      updatedCount += 1;
    } else {
      scoredByLeadId.set(row.lead_id, normalized);
      createdCount += 1;
    }
  }

  const nextScoredRows = Array.from(scoredByLeadId.values());
  await overwriteSheet(config.sheetTabs.scoredLeads, nextScoredRows, scoredLeadColumns);

  const updatedRawRows = rawRows.map((row) =>
    row.raw_status === "ready_for_scoring" ? { ...row, raw_status: "scored" } : row
  );
  await overwriteSheet(config.sheetTabs.rawLeads, updatedRawRows, rawLeadColumns);

  logInfo("Scored leads", {
    count: scorableRows.length,
    createdCount,
    updatedCount
  });
}
