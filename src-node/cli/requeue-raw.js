import { config } from "../config.js";
import { rawLeadColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";
import { logError, logInfo } from "../lib/logger.js";

async function requeueRaw() {
  const rawRows = await readSheet(config.sheetTabs.rawLeads);
  const updatedRawRows = rawRows.map((row) =>
    row.raw_status ? { ...row, raw_status: "ready_for_scoring" } : row
  );

  await overwriteSheet(config.sheetTabs.rawLeads, updatedRawRows, rawLeadColumns);
  logInfo("Requeued all raw rows for scoring", { count: updatedRawRows.length });
}

try {
  await requeueRaw();
} catch (error) {
  logError("Requeue raw command failed", { error: error.message });
  process.exit(1);
}
