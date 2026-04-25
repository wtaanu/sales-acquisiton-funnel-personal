import { outreachDraftColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";
import { config } from "../config.js";

function toSortableStamp(value) {
  return value || "";
}

async function main() {
  const requestedCount = Number(process.argv[2] || "10");
  const reviewCount = Number.isFinite(requestedCount) && requestedCount > 0 ? requestedCount : 10;
  const rows = await readSheet(config.sheetTabs.outreachDrafts);

  const candidates = rows
    .filter((row) => row.draft_type === "initial" && row.draft_status === "ready")
    .sort((a, b) => toSortableStamp(a.drafted_at).localeCompare(toSortableStamp(b.drafted_at)));

  const selectedLeadIds = new Set();
  const selectedDraftIds = new Set();

  for (const row of candidates) {
    if (selectedLeadIds.has(row.lead_id)) {
      continue;
    }
    selectedLeadIds.add(row.lead_id);
    selectedDraftIds.add(`${row.lead_id}::${row.draft_id}::${row.drafted_at}`);
    if (selectedLeadIds.size >= reviewCount) {
      break;
    }
  }

  const updatedRows = rows.map((row) => {
    const key = `${row.lead_id}::${row.draft_id}::${row.drafted_at}`;
    if (selectedDraftIds.has(key)) {
      return { ...row, draft_status: "reviewed" };
    }
    return row;
  });

  await overwriteSheet(config.sheetTabs.outreachDrafts, updatedRows, outreachDraftColumns);

  console.log(
    JSON.stringify(
      {
        requestedCount: reviewCount,
        reviewedCount: selectedLeadIds.size,
        reviewedCompanies: updatedRows
          .filter((row) => row.draft_status === "reviewed" && selectedLeadIds.has(row.lead_id))
          .map((row) => row.company_name)
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
