import { approvedLeadColumns, inboundReplyColumns, replyDraftColumns } from "../constants/sheetColumns.js";
import { appendRows, overwriteSheet, readSheet } from "../lib/google-sheets.js";
import { logInfo, logWarn } from "../lib/logger.js";
import { nowIso } from "../lib/time.js";
import { fetchRecentReplies, canReadInbox } from "../services/imap-replies.js";
import { buildSuggestedReply, classifyReply } from "../services/reply-drafts.js";
import { config } from "../config.js";

function mapByEmail(rows) {
  return new Map(rows.filter((row) => row.email).map((row) => [String(row.email).toLowerCase(), row]));
}

function existingMessageIds(rows) {
  return new Set(rows.map((row) => row.message_id).filter(Boolean));
}

function existingReplyIds(rows) {
  return new Set(rows.map((row) => row.reply_id).filter(Boolean));
}

export async function runReadInboxRepliesJob() {
  if (!canReadInbox()) {
    logWarn("IMAP not configured; skipping reply capture");
    return;
  }

  const [approvedRows, inboundRows, replyDraftRows] = await Promise.all([
    readSheet(config.sheetTabs.approvedLeads),
    readSheet(config.sheetTabs.inboundReplies),
    readSheet(config.sheetTabs.replyDrafts)
  ]);

  const approvedByEmail = mapByEmail(approvedRows);
  const seenMessageIds = existingMessageIds(inboundRows);
  const seenReplyIds = existingReplyIds(replyDraftRows);
  const fetchedReplies = await fetchRecentReplies();

  const newInboundValues = [];
  const newReplyDraftValues = [];
  let matchedCount = 0;

  for (const reply of fetchedReplies) {
    if (!reply.message_id || seenMessageIds.has(reply.message_id)) {
      continue;
    }

    const approvedLead = approvedByEmail.get(reply.from_email);
    if (!approvedLead) {
      continue;
    }

    matchedCount += 1;
    const replyMeta = classifyReply(reply.reply_text);
    const replyId = `${approvedLead.lead_id}-${reply.uid || reply.received_at}`;

    newInboundValues.push(
      inboundReplyColumns.map((column) => {
        const mapped = {
          reply_id: replyId,
          message_id: reply.message_id,
          lead_id: approvedLead.lead_id,
          company_name: approvedLead.company_name,
          buyer_name: approvedLead.buyer_name,
          buyer_title: approvedLead.buyer_title,
          from_email: reply.from_email,
          subject: reply.subject,
          received_at: reply.received_at,
          in_reply_to: reply.in_reply_to,
          references: reply.references,
          reply_text: reply.reply_text,
          reply_category: replyMeta.category,
          reply_sentiment: replyMeta.sentiment,
          next_action: replyMeta.next_action,
          source_status: approvedLead.send_status || ""
        };
        return mapped[column] ?? "";
      })
    );

    if (!seenReplyIds.has(replyId)) {
      const suggestion = buildSuggestedReply(
        {
          ...reply,
          ...replyMeta,
          reply_id: replyId,
          lead_id: approvedLead.lead_id,
          company_name: approvedLead.company_name,
          buyer_name: approvedLead.buyer_name
        },
        approvedLead
      );

      newReplyDraftValues.push(
        replyDraftColumns.map((column) => {
          const mapped = {
            reply_id: replyId,
            lead_id: approvedLead.lead_id,
            company_name: approvedLead.company_name,
            buyer_name: approvedLead.buyer_name,
            from_email: reply.from_email,
            original_subject: reply.subject,
            reply_category: replyMeta.category,
            suggested_subject: suggestion.suggested_subject,
            suggested_reply_text: suggestion.suggested_reply_text,
            suggested_reply_html: suggestion.suggested_reply_html,
            draft_status: "pending_review",
            drafted_at: nowIso()
          };
          return mapped[column] ?? "";
        })
      );
    }

    approvedLead.send_status = "replied";
    approvedLead.next_action = replyMeta.next_action;
  }

  if (newInboundValues.length) {
    await appendRows(config.sheetTabs.inboundReplies, newInboundValues);
  }

  if (newReplyDraftValues.length) {
    await appendRows(config.sheetTabs.replyDrafts, newReplyDraftValues);
  }

  await overwriteSheet(config.sheetTabs.approvedLeads, approvedRows, approvedLeadColumns);

  logInfo("Captured inbox replies", {
    fetchedCount: fetchedReplies.length,
    matchedCount,
    inboundSaved: newInboundValues.length,
    replyDraftsCreated: newReplyDraftValues.length
  });
}
