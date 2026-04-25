import { config } from "../config.js";
import { crmSyncColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSettingsMap, readSheet } from "../lib/google-sheets.js";
import { logInfo } from "../lib/logger.js";
import { nowIso } from "../lib/time.js";

function chooseSyncStatus(company, approvedRowsForCompany) {
  if (company.funnel_stage === "engaged") {
    return "ready_to_sync";
  }

  if (approvedRowsForCompany.some((row) => row.send_status === "sent_1" || row.send_status === "sent_2")) {
    return "outreach_synced";
  }

  if (Number(company.highest_lead_score || 0) >= 70) {
    return "review_for_sync";
  }

  return "hold";
}

function chooseRecordType(company) {
  if (company.funnel_stage === "engaged") {
    return "opportunity";
  }

  if (Number(company.highest_lead_score || 0) >= 60) {
    return "account";
  }

  return "lead";
}

export async function runSyncCrmRecordsJob() {
  const settings = await readSettingsMap(config.sheetTabs.settings);
  const [companyRows, approvedRows, existingSyncRows] = await Promise.all([
    readSheet(config.sheetTabs.companyIntel),
    readSheet(config.sheetTabs.approvedLeads),
    readSheet(config.sheetTabs.crmSync)
  ]);

  const existingMap = new Map(
    existingSyncRows.map((row) => [`${row.company_id}::${row.email}`, row])
  );

  const approvedByCompany = approvedRows.reduce((accumulator, row) => {
    const list = accumulator.get(row.company_name) || [];
    list.push(row);
    accumulator.set(row.company_name, list);
    return accumulator;
  }, new Map());

  const crmName = settings.crm_default_name || "personal_crm";
  const syncedAt = nowIso();
  const nextRows = [];

  for (const company of companyRows) {
    const approvedForCompany = approvedByCompany.get(company.company_name) || [];
    const primaryApproved = approvedForCompany[0] || null;
    const email = primaryApproved?.email || "";
    const leadId = primaryApproved?.lead_id || "";
    const key = `${company.company_id}::${email}`;
    const existing = existingMap.get(key) || {};

    nextRows.push({
      sync_id: existing.sync_id || `${crmName}::${company.company_id}`,
      company_id: company.company_id,
      company_name: company.company_name,
      lead_id: leadId,
      email,
      crm_name: crmName,
      crm_record_type: chooseRecordType(company),
      crm_record_id: existing.crm_record_id || "",
      sync_status: existing.sync_status || chooseSyncStatus(company, approvedForCompany),
      last_synced_at: syncedAt,
      sync_note:
        existing.sync_note ||
        company.next_best_action ||
        company.ai_prediction ||
        "Track this account in the personal CRM for follow-up."
    });
  }

  nextRows.sort((left, right) => left.company_name.localeCompare(right.company_name));
  await overwriteSheet(config.sheetTabs.crmSync, nextRows, crmSyncColumns);
  logInfo("Prepared CRM sync records", {
    companyCount: companyRows.length,
    crmName
  });
}
