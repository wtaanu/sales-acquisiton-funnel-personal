import { config } from "../config.js";
import {
  alertColumns,
  approvedLeadColumns,
  companyIntelColumns,
  crmSyncColumns,
  crmExportMappingColumns,
  crmExportReadyColumns,
  defaultCrmExportMappingRows,
  defaultSavedSearchRows,
  defaultSettingsRows,
  enrichmentAddonColumns,
  inboundReplyColumns,
  outreachDraftColumns,
  replyDraftColumns,
  rawLeadColumns,
  savedSearchColumns,
  scoredLeadColumns,
  watchlistColumns
} from "../constants/sheetColumns.js";
import {
  ensureSeedRows,
  ensureSettingsRows,
  ensureSheetTabs,
  writeHeaderRow
} from "../lib/google-sheets.js";
import { logError, logInfo } from "../lib/logger.js";

const tabHeaders = {
  [config.sheetTabs.rawLeads]: rawLeadColumns,
  [config.sheetTabs.scoredLeads]: scoredLeadColumns,
  [config.sheetTabs.approvedLeads]: approvedLeadColumns,
  [config.sheetTabs.outreachDrafts]: outreachDraftColumns,
  [config.sheetTabs.inboundReplies]: inboundReplyColumns,
  [config.sheetTabs.replyDrafts]: replyDraftColumns,
  [config.sheetTabs.companyIntel]: companyIntelColumns,
  [config.sheetTabs.enrichmentAddons]: enrichmentAddonColumns,
  [config.sheetTabs.savedSearches]: savedSearchColumns,
  [config.sheetTabs.watchlists]: watchlistColumns,
  [config.sheetTabs.alerts]: alertColumns,
  [config.sheetTabs.crmSync]: crmSyncColumns,
  [config.sheetTabs.crmExportMappings]: crmExportMappingColumns,
  [config.sheetTabs.crmExportReady]: crmExportReadyColumns
};

async function bootstrapSheets() {
  const sheetNames = Object.values(config.sheetTabs);
  await ensureSheetTabs(sheetNames);

  for (const [sheetName, columns] of Object.entries(tabHeaders)) {
    await writeHeaderRow(sheetName, columns);
    logInfo("Wrote sheet headers", { sheetName, columnCount: columns.length });
  }

  await ensureSettingsRows(config.sheetTabs.settings, defaultSettingsRows);
  logInfo("Wrote settings rows", { sheetName: config.sheetTabs.settings, rowCount: defaultSettingsRows.length });

  await ensureSeedRows(config.sheetTabs.savedSearches, savedSearchColumns, defaultSavedSearchRows);
  logInfo("Ensured saved search seed rows", {
    sheetName: config.sheetTabs.savedSearches,
    rowCount: defaultSavedSearchRows.length
  });

  await ensureSeedRows(config.sheetTabs.crmExportMappings, crmExportMappingColumns, defaultCrmExportMappingRows);
  logInfo("Ensured CRM export mapping seed rows", {
    sheetName: config.sheetTabs.crmExportMappings,
    rowCount: defaultCrmExportMappingRows.length
  });
}

try {
  await bootstrapSheets();
  logInfo("Sheet bootstrap completed", { spreadsheetId: config.googleSheetsId });
} catch (error) {
  logError("Sheet bootstrap failed", { error: error.message });
  process.exit(1);
}
