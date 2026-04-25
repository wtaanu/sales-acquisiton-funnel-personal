import { config } from "../config.js";
import { logInfo } from "../lib/logger.js";
import { todayIsoDate } from "../lib/time.js";
import { readSheet } from "../lib/google-sheets.js";

export async function runWeeklyReportJob() {
  const [rawLeads, scoredLeads, approvedLeads, drafts] = await Promise.all([
    readSheet(config.sheetTabs.rawLeads),
    readSheet(config.sheetTabs.scoredLeads),
    readSheet(config.sheetTabs.approvedLeads),
    readSheet(config.sheetTabs.outreachDrafts)
  ]);

  logInfo("Weekly pipeline snapshot", {
    date: todayIsoDate(),
    rawLeadCount: rawLeads.length,
    scoredLeadCount: scoredLeads.length,
    approvedLeadCount: approvedLeads.length,
    draftCount: drafts.length
  });
}
