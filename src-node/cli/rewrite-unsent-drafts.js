import { config } from "../config.js";
import { outreachDraftColumns, rawLeadColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";
import {
  buildCta,
  buildEmailBodyHtml,
  buildEmailBodyText,
  buildLoomAngle,
  buildSubjectLine
} from "../services/drafts.js";
import {
  buildFollowupCta,
  buildFollowupHtml,
  buildFollowupSubject,
  buildFollowupText
} from "../services/followups.js";

function mergeLeadContext(...rows) {
  return Object.assign({}, ...rows.filter(Boolean));
}

function sendStatusForDraft(row) {
  if (row.parent_send_status) {
    return row.parent_send_status;
  }
  if (row.draft_type === "followup_1") {
    return "sent_1";
  }
  if (row.draft_type === "followup_2") {
    return "sent_2";
  }
  if (row.draft_type === "close_loop") {
    return "loom_sent";
  }
  return "not_sent";
}

async function main() {
  const [rawRows, scoredRows, approvedRows, draftRows] = await Promise.all([
    readSheet(config.sheetTabs.rawLeads),
    readSheet(config.sheetTabs.scoredLeads),
    readSheet(config.sheetTabs.approvedLeads),
    readSheet(config.sheetTabs.outreachDrafts)
  ]);

  const rawByLeadId = new Map(rawRows.map((row) => [row.lead_id, row]));
  const scoredByLeadId = new Map(scoredRows.map((row) => [row.lead_id, row]));
  const approvedByLeadId = new Map(approvedRows.map((row) => [row.lead_id, row]));

  let rewrittenInitialCount = 0;
  let rewrittenFollowupCount = 0;

  const updatedDraftRows = draftRows.map((row) => {
    if (row.draft_status === "sent") {
      return row;
    }

    const context = mergeLeadContext(
      rawByLeadId.get(row.lead_id),
      scoredByLeadId.get(row.lead_id),
      approvedByLeadId.get(row.lead_id),
      row
    );

    if (row.draft_type === "initial") {
      rewrittenInitialCount += 1;
      return {
        ...row,
        subject_line: buildSubjectLine(context),
        email_body_text: buildEmailBodyText(context),
        email_body_html: buildEmailBodyHtml(context),
        loom_angle: buildLoomAngle(context),
        cta: buildCta()
      };
    }

    if (["followup_1", "followup_2", "close_loop"].includes(row.draft_type)) {
      const sendStatus = sendStatusForDraft(row);
      rewrittenFollowupCount += 1;
      return {
        ...row,
        subject_line: buildFollowupSubject(context, sendStatus),
        email_body_text: buildFollowupText(context, sendStatus),
        email_body_html: buildFollowupHtml(context, sendStatus),
        cta: buildFollowupCta(sendStatus)
      };
    }

    return row;
  });

  await overwriteSheet(config.sheetTabs.outreachDrafts, updatedDraftRows, outreachDraftColumns);

  console.log(
    JSON.stringify(
      {
        rewrittenInitialCount,
        rewrittenFollowupCount,
        untouchedSentCount: draftRows.filter((row) => row.draft_status === "sent").length
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
