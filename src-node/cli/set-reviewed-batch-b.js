import { config } from "../config.js";
import { outreachDraftColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";

const batchBCompanies = new Set([
  "UDR Consulting, Inc.",
  "Atlas Staffing, Inc.",
  "StoneArch Logistics, LLC.",
  "Top Shelf Staffing,LLC",
  "Antrazal",
  "ONCALL Staffing",
  "Zivio",
  "Renhead",
  "Lucid Staffing Solutions",
  "Clyde Staffing",
  "OUTSOURCE Consulting Services, Inc. (OCSI.co)",
  "VoltTalent Staffing",
  "Legal.io",
  "Ovyo",
  "Triunity Software, Inc.",
  "Advanced Automation Consulting",
  "Prominent",
  "Lead Out Software",
  "Gradient Works",
  "LaserBeam Software"
]);

async function main() {
  const rows = await readSheet(config.sheetTabs.outreachDrafts);
  const chosenIndexes = new Set();
  const seenCompanies = new Set();

  const candidateRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.draft_type === "initial" && row.draft_status === "ready" && batchBCompanies.has(row.company_name))
    .sort((a, b) => String(b.row.drafted_at || "").localeCompare(String(a.row.drafted_at || "")));

  for (const candidate of candidateRows) {
    if (seenCompanies.has(candidate.row.company_name)) {
      continue;
    }
    seenCompanies.add(candidate.row.company_name);
    chosenIndexes.add(candidate.index);
  }

  const updatedRows = rows.map((row, index) => {
    if (row.draft_type !== "initial") {
      return row;
    }

    const isSelectedCompany = batchBCompanies.has(row.company_name);
    const isChosenRow = isSelectedCompany && chosenIndexes.has(index);

    if (isSelectedCompany && isChosenRow && row.draft_status === "ready") {
      return { ...row, draft_status: "reviewed" };
    }

    if (isSelectedCompany && row.draft_status === "reviewed" && !isChosenRow) {
      return { ...row, draft_status: "ready" };
    }

    return row;
  });

  await overwriteSheet(config.sheetTabs.outreachDrafts, updatedRows, outreachDraftColumns);

  const reviewedCompanies = updatedRows
    .filter((row) => row.draft_status === "reviewed" && row.draft_type === "initial" && batchBCompanies.has(row.company_name))
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
