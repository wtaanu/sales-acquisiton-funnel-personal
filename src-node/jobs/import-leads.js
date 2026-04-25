import { config } from "../config.js";
import { rawLeadColumns } from "../constants/sheetColumns.js";
import { readCsvRows } from "../lib/csv.js";
import { appendRows, readSheet } from "../lib/google-sheets.js";
import { buildLeadId } from "../lib/lead-id.js";
import { logInfo } from "../lib/logger.js";
import { nowIso } from "../lib/time.js";
import { fetchApolloPeople } from "../services/apollo.js";

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getValue(row, aliases) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);
    const match = entries.find(([key]) => normalizeHeader(key) === normalizedAlias);
    if (match && match[1]) {
      return String(match[1]).trim();
    }
  }
  return "";
}

function mapImportedRow(row, timestamp) {
  const companyName = getValue(row, ["company", "company_name"]);
  const email = getValue(row, ["email", "work_email"]);
  const buyerName = getValue(row, ["buyer_name", "name", "contact_name"]);
  const buyerTitle = getValue(row, ["buyer_title", "job_title", "title"]);
  const notes = getValue(row, ["pain_notes", "notes", "manual_diagnosis", "manual_discovery"]);
  const pitchAngle = getValue(row, ["pitch_angle", "pitch_angl"]);
  const sourceUrl = getValue(row, ["source_url", "source ur", "source"]);
  const industry = getValue(row, ["industry"]);
  const recentSignal = getValue(row, ["recent_signal", "status", "reply_received"]);
  const roiBenefit = getValue(row, ["roi_benefit", "roi benef"]);
  const searchQuery = getValue(row, ["search_query", "search query"]);

  return {
    lead_id: buildLeadId({ company_name: companyName, email }),
    company_name: companyName,
    country: getValue(row, ["country"]),
    industry,
    employee_count: getValue(row, ["employee_count", "employees", "team_size"]),
    funding_stage: getValue(row, ["funding_stage", "funding"]),
    recent_signal: [recentSignal, searchQuery].filter(Boolean).join(" | "),
    hiring_signal: getValue(row, ["hiring_signal", "job_title", "job title"]),
    tech_stack: getValue(row, ["tech_stack", "attachments", "attachment"]),
    pain_notes: [notes, pitchAngle, roiBenefit].filter(Boolean).join(" | "),
    buyer_name: buyerName,
    buyer_title: buyerTitle,
    email,
    website: getValue(row, ["website", "company_website"]),
    linkedin_url: getValue(row, ["linkedin_url", "linkedin"]),
    source: sourceUrl || "apollo",
    raw_status: "ready_for_scoring",
    imported_at: timestamp
  };
}

export async function runImportLeadsJob() {
  const rows =
    config.apollo.importMode === "apollo"
      ? await fetchApolloPeople()
      : readCsvRows(config.apolloImportFile);
  const existingRawRows = await readSheet(config.sheetTabs.rawLeads);
  const existingLeadIds = new Set(existingRawRows.map((row) => row.lead_id).filter(Boolean));
  const timestamp = nowIso();

  const values = rows.map((row) => {
    const normalized = mapImportedRow(row, timestamp);
    return rawLeadColumns.map((column) => normalized[column] || "");
  }).filter((row) => !existingLeadIds.has(row[0]));

  if (values.length) {
    await appendRows(config.sheetTabs.rawLeads, values);
  }
  logInfo("Imported leads into Raw Leads", {
    count: values.length,
    dedupedAgainstExisting: existingLeadIds.size,
    importMode: config.apollo.importMode
  });
}
