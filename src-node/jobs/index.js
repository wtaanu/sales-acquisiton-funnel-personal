import { runBuildCompanyIntelJob } from "./build-company-intel.js";
import { runBuildCrmExportReadyJob } from "./build-crm-export-ready.js";
import { runBuildEnrichmentAddonsJob } from "./build-enrichment-addons.js";
import { runBuildWatchlistsJob } from "./build-watchlists.js";
import { runGenerateAccountAlertsJob } from "./generate-account-alerts.js";
import { runGenerateDraftsJob } from "./generate-drafts.js";
import { runGenerateFollowupsJob } from "./generate-followups.js";
import { runImportLeadsJob } from "./import-leads.js";
import { runReadInboxRepliesJob } from "./read-inbox-replies.js";
import { runScoreLeadsJob } from "./score-leads.js";
import { runSendReviewedDraftsJob } from "./send-reviewed-drafts.js";
import { runSendTestEmailJob } from "./send-test-email.js";
import { runSyncCrmRecordsJob } from "./sync-crm-records.js";
import { runTestApolloJob } from "./test-apollo.js";
import { runVerifyEmailsJob } from "./verify-emails.js";
import { runWeeklyReportJob } from "./weekly-report.js";

export const jobs = {
  "import-leads": runImportLeadsJob,
  "score-leads": runScoreLeadsJob,
  "verify-emails": runVerifyEmailsJob,
  "build-company-intel": runBuildCompanyIntelJob,
  "build-enrichment-addons": runBuildEnrichmentAddonsJob,
  "build-watchlists": runBuildWatchlistsJob,
  "generate-account-alerts": runGenerateAccountAlertsJob,
  "sync-crm-records": runSyncCrmRecordsJob,
  "build-crm-export-ready": runBuildCrmExportReadyJob,
  "read-inbox-replies": runReadInboxRepliesJob,
  "generate-drafts": runGenerateDraftsJob,
  "generate-followups": runGenerateFollowupsJob,
  "send-reviewed-drafts": runSendReviewedDraftsJob,
  "send-test-email": runSendTestEmailJob,
  "test-apollo": runTestApolloJob,
  "weekly-report": runWeeklyReportJob
};
