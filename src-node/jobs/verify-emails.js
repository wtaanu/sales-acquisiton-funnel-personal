import { config } from "../config.js";
import { approvedLeadColumns, scoredLeadColumns } from "../constants/sheetColumns.js";
import { appendRows, overwriteSheet, readSettingsMap, readSheet } from "../lib/google-sheets.js";
import { logInfo } from "../lib/logger.js";
import { nowIso } from "../lib/time.js";
import { normalizeVerification, verifyEmail } from "../services/zerobounce.js";

export async function runVerifyEmailsJob() {
  const settings = await readSettingsMap(config.sheetTabs.settings);
  const minimumScore = Number(settings.minimum_score || config.minimumScore);
  const scoredRows = await readSheet(config.sheetTabs.scoredLeads);
  const pendingRows = scoredRows.filter(
    (row) => row.verification_status === "pending" && Number(row.lead_score || 0) >= minimumScore
  );

  const approvedValues = [];
  for (const row of pendingRows) {
    const result = await verifyEmail(row.email);
    const normalized = normalizeVerification(result);
    row.verification_status = normalized.verification_status;
    row.verification_sub_status = normalized.verification_sub_status;
    row.verification_checked_at = nowIso();
    row.verification_notes = result.notes || "";

    if (["approved_for_review", "manual_review"].includes(row.verification_status)) {
      approvedValues.push(
        approvedLeadColumns.map((column) => {
          const mapped = {
            lead_id: row.lead_id,
            company_name: row.company_name,
            buyer_name: row.buyer_name,
            buyer_title: row.buyer_title,
            email: row.email,
            recommended_offer: row.recommended_offer,
            lead_score: row.lead_score,
            verification_status: row.verification_status,
            approval_status: "pending_review",
            owner: "",
            send_status: "not_sent",
            next_action: "Review before outreach draft generation",
            approved_at: nowIso()
          };
          return mapped[column] ?? "";
        })
      );
    }
  }

  await overwriteSheet(config.sheetTabs.scoredLeads, scoredRows, scoredLeadColumns);
  if (approvedValues.length) {
    await appendRows(config.sheetTabs.approvedLeads, approvedValues);
  }

  logInfo("Verified scored leads", {
    processed: pendingRows.length,
    movedToApproved: approvedValues.length,
    minimumScore
  });
}
