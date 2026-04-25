import { config } from "../config.js";
import { approvedLeadColumns, outreachDraftColumns } from "../constants/sheetColumns.js";
import { appendRows, overwriteSheet, readSheet } from "../lib/google-sheets.js";
import { logInfo } from "../lib/logger.js";
import { nowIso } from "../lib/time.js";
import {
  buildCta,
  buildEmailBodyHtml,
  buildEmailBodyText,
  buildLoomAngle,
  buildSubjectLine
} from "../services/drafts.js";

export async function runGenerateDraftsJob() {
  const approvedRows = await readSheet(config.sheetTabs.approvedLeads);
  const approvedForDrafts = approvedRows.filter(
    (row) => row.approval_status === "approved" && row.send_status === "not_sent"
  );

  const draftValues = approvedForDrafts.map((row) => {
    const enriched = {
      ...row,
      draft_id: `${row.lead_id}-initial`,
      draft_type: "initial",
      sequence_step: "1",
      subject_line: buildSubjectLine(row),
      email_body_text: buildEmailBodyText(row),
      email_body_html: buildEmailBodyHtml(row),
      loom_angle: buildLoomAngle(row),
      cta: buildCta(),
      parent_send_status: row.send_status || "not_sent",
      signature_name: config.defaultSignatureName,
      signature_company: config.defaultSignatureCompany,
      logo_mode: config.logoMode,
      logo_url: config.logoUrl,
      draft_source: "apollo_client_acquisition",
      source_record_id: row.lead_id,
      draft_status: "ready",
      send_result: "",
      sent_at: "",
      drafted_at: nowIso()
    };
    return outreachDraftColumns.map((column) => enriched[column] ?? "");
  });

  if (draftValues.length) {
    await appendRows(config.sheetTabs.outreachDrafts, draftValues);
  }

  const updatedApprovedRows = approvedRows.map((row) =>
    row.approval_status === "approved" && row.send_status === "not_sent"
      ? { ...row, send_status: "draft_ready" }
      : row
  );

  await overwriteSheet(config.sheetTabs.approvedLeads, updatedApprovedRows, approvedLeadColumns);
  logInfo("Generated outreach drafts", { count: draftValues.length });
}
