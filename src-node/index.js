import cron from "node-cron";
import { jobs } from "./jobs/index.js";
import { logInfo } from "./lib/logger.js";

const schedules = [
  { name: "import-leads", expression: "0 9 * * 1-5" },
  { name: "score-leads", expression: "*/30 * * * *" },
  { name: "verify-emails", expression: "15,45 * * * *" },
  { name: "build-company-intel", expression: "5 * * * *" },
  { name: "build-enrichment-addons", expression: "6 * * * *" },
  { name: "build-watchlists", expression: "7 * * * *" },
  { name: "generate-account-alerts", expression: "10 * * * *" },
  { name: "sync-crm-records", expression: "12 * * * *" },
  { name: "build-crm-export-ready", expression: "14 * * * *" },
  { name: "read-inbox-replies", expression: "*/15 9-19 * * 1-5" },
  { name: "generate-drafts", expression: "0 * * * *" },
  { name: "generate-followups", expression: "15 11-17 * * 1-5" },
  { name: "send-reviewed-drafts", expression: "30 10-17 * * 1-5" },
  { name: "weekly-report", expression: "0 18 * * 5" }
];

for (const schedule of schedules) {
  cron.schedule(schedule.expression, async () => {
    logInfo("Running scheduled job", { jobName: schedule.name, schedule: schedule.expression });
    try {
      await jobs[schedule.name]();
    } catch (error) {
      console.error(error);
    }
  });
}

logInfo("Node.js scheduler started", { scheduledJobs: schedules.length });
