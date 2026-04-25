import { config } from "../config.js";
import { approvedLeadColumns, outreachDraftColumns } from "../constants/sheetColumns.js";
import { appendRows, overwriteSheet, readSheet } from "../lib/google-sheets.js";
import { logInfo } from "../lib/logger.js";
import { nowIso } from "../lib/time.js";
import {
  buildFollowupCta,
  buildFollowupHtml,
  buildFollowupSubject,
  buildFollowupText,
  getFollowupPlan
} from "../services/followups.js";

export async function runGenerateFollowupsJob() {
  const approvedRows = await readSheet(config.sheetTabs.approvedLeads);
  const existingDrafts = await readSheet(config.sheetTabs.outreachDrafts);
  const existingDraftIds = new Set(existingDrafts.map((row) => row.draft_id).filter(Boolean));

  const candidates = approvedRows.filter((row) => ["sent_1", "sent_2", "loom_sent"].includes(row.send_status));
  const followupValues = [];

  for (const row of candidates) {
    const plan = getFollowupPlan(row.send_status);
    if (!plan) {
      continue;
    }

    const draftId = `${row.lead_id}-${plan.draft_type}`;
    if (existingDraftIds.has(draftId)) {
      continue;
    }

    const enriched = {
      ...row,
      draft_id: draftId,
      draft_type: plan.draft_type,
      sequence_step: plan.sequence_step,
      parent_send_status: row.send_status,
      subject_line: buildFollowupSubject(row, row.send_status),
      email_body_text: buildFollowupText(row, row.send_status),
      email_body_html: buildFollowupHtml(row, row.send_status),
      loom_angle: "",
      cta: buildFollowupCta(row.send_status),
      signature_name: config.defaultSignatureName,
      signature_company: config.defaultSignatureCompany,
      logo_mode: config.logoMode,
      logo_url: config.logoUrl,
      draft_status: "ready",
      send_result: "",
      sent_at: "",
      drafted_at: nowIso()
    };

    followupValues.push(outreachDraftColumns.map((column) => enriched[column] ?? ""));
    row.next_action = `Review ${plan.draft_type} draft`;
  }

  if (followupValues.length) {
    await appendRows(config.sheetTabs.outreachDrafts, followupValues);
    await overwriteSheet(config.sheetTabs.approvedLeads, approvedRows, approvedLeadColumns);
  }

  logInfo("Generated follow-up drafts", { count: followupValues.length });
}
