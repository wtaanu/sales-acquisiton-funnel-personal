import { config } from "../config.js";
import { approvedLeadColumns, outreachDraftColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSettingsMap, readSheet } from "../lib/google-sheets.js";
import { logInfo, logWarn } from "../lib/logger.js";
import { nowIso } from "../lib/time.js";
import { canSendEmail, sendMail } from "../services/smtp.js";
import { isWeekend } from "../services/sales-campaigns.js";

function buildApprovedMap(rows) {
  return new Map(rows.map((row) => [row.lead_id, row]));
}

function getNextSendStatus(draftType, currentStatus) {
  if (draftType === "followup_1") {
    return "sent_2";
  }
  if (draftType === "followup_2") {
    return "loom_sent";
  }
  if (draftType === "close_loop") {
    return "sequence_complete";
  }
  return currentStatus === "sent_1" ? "sent_1" : "sent_1";
}

function getNextAction(draftType) {
  if (draftType === "followup_1") {
    return "Wait for reply or review second follow-up timing";
  }
  if (draftType === "followup_2") {
    return "Wait for reply or prepare close-loop message";
  }
  if (draftType === "close_loop") {
    return "Sequence complete; monitor for late replies";
  }
  return "Wait for reply or schedule follow-up";
}

export async function runSendReviewedDraftsJob() {
  if (isWeekend()) {
    logWarn("Weekend sending is blocked; skipping reviewed draft send run");
    return;
  }

  const settings = await readSettingsMap(config.sheetTabs.settings);
  const maxPerRun = Number(settings.send_max_per_run || config.smtp.maxPerRun);
  const approvedRows = await readSheet(config.sheetTabs.approvedLeads);
  const draftRows = await readSheet(config.sheetTabs.outreachDrafts);

  const sendableDrafts = draftRows
    .filter((row) => row.draft_status === "reviewed")
    .slice(0, maxPerRun);

  if (!sendableDrafts.length) {
    logInfo("No reviewed drafts available for sending", { maxPerRun });
    return;
  }

  if (!canSendEmail()) {
    logWarn("SMTP not configured; skipping send run", { maxPerRun });
    return;
  }

  const approvedMap = buildApprovedMap(approvedRows);
  let sentCount = 0;

  for (const draft of sendableDrafts) {
    await sendMail({
      to: draft.email,
      subject: draft.subject_line,
      text: draft.email_body_text,
      html: draft.email_body_html,
      headers: {
        "X-Anutech-Draft-Source": draft.draft_source || "client_acquisition",
        "X-Anutech-Source-Record-Id": draft.source_record_id || draft.draft_id || draft.lead_id
      }
    });

    draft.draft_status = "sent";
    draft.send_result = "sent";
    draft.sent_at = nowIso();

    const approvedRow = approvedMap.get(draft.lead_id);
    if (approvedRow) {
      approvedRow.send_status = getNextSendStatus(draft.draft_type, approvedRow.send_status);
      approvedRow.next_action = getNextAction(draft.draft_type);
    }
    sentCount += 1;
  }

  await overwriteSheet(config.sheetTabs.outreachDrafts, draftRows, outreachDraftColumns);
  await overwriteSheet(config.sheetTabs.approvedLeads, approvedRows, approvedLeadColumns);
  logInfo("Sent reviewed outreach drafts", { sentCount, maxPerRun });
}
