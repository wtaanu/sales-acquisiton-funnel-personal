import { config } from "../config.js";
import { rawLeadColumns, scoredLeadColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";
import { logError, logInfo } from "../lib/logger.js";

async function resetScored() {
  const rawRows = await readSheet(config.sheetTabs.rawLeads);
  const updatedRawRows = rawRows.map((row) =>
    row.raw_status === "scored" ? { ...row, raw_status: "ready_for_scoring" } : row
  );

  await overwriteSheet(config.sheetTabs.scoredLeads, [], scoredLeadColumns);
  await overwriteSheet(config.sheetTabs.rawLeads, updatedRawRows, rawLeadColumns);
  logInfo("Reset scored workflow state", {
    clearedScoredLeads: true,
    requeuedRawRows: updatedRawRows.filter((row) => row.raw_status === "ready_for_scoring").length
  });
}

try {
  await resetScored();
} catch (error) {
  logError("Reset scored command failed", { error: error.message });
  process.exit(1);
}
