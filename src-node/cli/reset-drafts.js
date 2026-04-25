import { config } from "../config.js";
import { approvedLeadColumns, outreachDraftColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";
import { logError, logInfo } from "../lib/logger.js";

try {
  const approvedRows = await readSheet(config.sheetTabs.approvedLeads);
  const updatedApprovedRows = approvedRows.map((row) =>
    row.send_status === "draft_ready"
      ? { ...row, send_status: "not_sent", next_action: "Regenerate and review draft" }
      : row
  );

  await overwriteSheet(config.sheetTabs.outreachDrafts, [], outreachDraftColumns);
  await overwriteSheet(config.sheetTabs.approvedLeads, updatedApprovedRows, approvedLeadColumns);

  logInfo("Reset outreach drafts", {
    clearedDrafts: true,
    resetApprovedRows: updatedApprovedRows.filter((row) => row.send_status === "not_sent").length
  });
} catch (error) {
  logError("Reset drafts failed", { error: error.message });
  process.exit(1);
}
