import { config } from "../config.js";
import { outreachDraftColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";

const batchACompanies = new Set([
  "508 Operations",
  "Kripson Staffing",
  "Trufflesecurity",
  "FleetPanda - Petroleum Logistics Software",
  "HRTM Consulting",
  "Josephine's Professional Staffing, Inc.",
  "Aqore Staffing Software",
  "ASAP Personnel Services",
  "Hire Energy Staffing",
  "Eikon Consulting Group | Staffing & Consulting Services"
]);

async function main() {
  const rows = await readSheet(config.sheetTabs.outreachDrafts);

  const updatedRows = rows.map((row) => {
    if (row.draft_status !== "reviewed") {
      return row;
    }

    if (row.draft_type !== "initial") {
      return row;
    }

    if (batchACompanies.has(row.company_name)) {
      return row;
    }

    return { ...row, draft_status: "ready" };
  });

  await overwriteSheet(config.sheetTabs.outreachDrafts, updatedRows, outreachDraftColumns);

  const reviewedCompanies = updatedRows
    .filter((row) => row.draft_status === "reviewed" && row.draft_type === "initial")
    .map((row) => row.company_name);

  console.log(
    JSON.stringify(
      {
        reviewedCount: reviewedCompanies.length,
        reviewedCompanies
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
