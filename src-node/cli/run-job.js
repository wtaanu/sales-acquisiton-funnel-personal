import { jobs } from "../jobs/index.js";
import { logError } from "../lib/logger.js";

const jobName = process.argv[2];

if (!jobName || !jobs[jobName]) {
  logError("Unknown or missing job name", { availableJobs: Object.keys(jobs), received: jobName });
  process.exit(1);
}

try {
  await jobs[jobName]();
} catch (error) {
  logError("Job execution failed", { jobName, error: error.message });
  process.exit(1);
}
