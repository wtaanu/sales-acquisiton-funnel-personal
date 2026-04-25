import { config } from "../config.js";
import { outreachDraftColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";

const weakCompanies = new Set([
  "Parashift",
  "Blockstream",
  "Sentry",
  "Eudia",
  "Robinhood",
  "SubstiToothFairy, Dental Staffing Service",
  "Coryer Staffing",
  "CFE Media and Technology",
  "Virtual Emily Staffing",
  "mCubed Staffing"
]);

async function main() {
  const rows = await readSheet(config.sheetTabs.outreachDrafts);

  let suppressedCount = 0;
  const updatedRows = rows.map((row) => {
    if (row.draft_type !== "initial") {
      return row;
    }

    if (!weakCompanies.has(row.company_name)) {
      return row;
    }

    if (row.draft_status === "sent") {
      return row;
    }

    if (row.draft_status !== "suppressed") {
      suppressedCount += 1;
    }

    return { ...row, draft_status: "suppressed" };
  });

  await overwriteSheet(config.sheetTabs.outreachDrafts, updatedRows, outreachDraftColumns);

  const remainingSuppressedCompanies = Array.from(
    new Set(
      updatedRows
        .filter((row) => row.draft_type === "initial" && row.draft_status === "suppressed")
        .map((row) => row.company_name)
    )
  );

  console.log(
    JSON.stringify(
      {
        suppressedCount,
        suppressedCompanies: remainingSuppressedCompanies
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
