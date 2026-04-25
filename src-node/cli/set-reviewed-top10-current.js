import { config } from "../config.js";
import { outreachDraftColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";

const top10Companies = new Set([
  "508 Operations",
  "JS Consulting Solution",
  "Kripson Staffing",
  "Croixstone Consulting",
  "C&E Logistics, LLC",
  "Thrive Staffing",
  "MedicalWorx Staffing",
  "OneSparQ",
  "Service Geeni: Service Management Software",
  "Elev8 Consulting LLC"
]);

async function main() {
  const rows = await readSheet(config.sheetTabs.outreachDrafts);

  const updatedRows = rows.map((row) => {
    if (row.draft_type !== "initial" || row.draft_status !== "reviewed") {
      return row;
    }

    if (top10Companies.has(row.company_name)) {
      return row;
    }

    return { ...row, draft_status: "ready" };
  });

  await overwriteSheet(config.sheetTabs.outreachDrafts, updatedRows, outreachDraftColumns);

  const reviewedCompanies = updatedRows
    .filter((row) => row.draft_type === "initial" && row.draft_status === "reviewed")
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
