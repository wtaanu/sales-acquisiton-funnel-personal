import { config } from "../config.js";
import {
  approvedLeadColumns,
  inboundReplyColumns,
  outreachDraftColumns,
  rawLeadColumns,
  replyDraftColumns,
  scoredLeadColumns
} from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";

const emailArgs = process.argv.slice(2)
  .map((value) => String(value || "").trim().toLowerCase())
  .filter(Boolean);

if (!emailArgs.length) {
  console.error("Provide at least one email to remove.");
  process.exit(1);
}

const blocked = new Set(emailArgs);

function keepRow(row) {
  const candidates = [
    row.email,
    row.from_email
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  return !candidates.some((email) => blocked.has(email));
}

async function rewriteSheet(sheetName, columns) {
  const rows = await readSheet(sheetName);
  const keptRows = rows.filter(keepRow);
  await overwriteSheet(sheetName, keptRows, columns);
  return {
    sheetName,
    removedCount: rows.length - keptRows.length
  };
}

async function main() {
  const results = await Promise.all([
    rewriteSheet(config.sheetTabs.rawLeads, rawLeadColumns),
    rewriteSheet(config.sheetTabs.scoredLeads, scoredLeadColumns),
    rewriteSheet(config.sheetTabs.approvedLeads, approvedLeadColumns),
    rewriteSheet(config.sheetTabs.outreachDrafts, outreachDraftColumns),
    rewriteSheet(config.sheetTabs.inboundReplies, inboundReplyColumns),
    rewriteSheet(config.sheetTabs.replyDrafts, replyDraftColumns)
  ]);

  console.log(JSON.stringify({
    removedEmails: Array.from(blocked),
    results
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
