import { config } from "../config.js";
import { outreachDraftColumns } from "../constants/sheetColumns.js";
import { readSheet, writeHeaderRow } from "../lib/google-sheets.js";
import { logError, logInfo } from "../lib/logger.js";

try {
  const existingRows = await readSheet(config.sheetTabs.outreachDrafts);
  await writeHeaderRow(config.sheetTabs.outreachDrafts, outreachDraftColumns);
  logInfo("Synced Outreach Drafts headers", {
    sheetName: config.sheetTabs.outreachDrafts,
    existingRowCount: existingRows.length,
    columnCount: outreachDraftColumns.length
  });
} catch (error) {
  logError("Sync outreach headers failed", { error: error.message });
  process.exit(1);
}
