import { config } from "../config.js";
import { crmExportReadyColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSettingsMap, readSheet } from "../lib/google-sheets.js";
import { logInfo } from "../lib/logger.js";

function buildPayload({ crmName, exportType, company, syncRow, enrichmentRow, approvedRow }) {
  const common = {
    company_name: company.company_name,
    company_id: company.company_id,
    website: company.website || enrichmentRow?.primary_domain || "",
    industry: company.industry || "",
    owner: company.owner || "",
    funnel_stage: company.funnel_stage || "",
    recommended_offer: company.recommended_offer || "",
    next_best_action: company.next_best_action || "",
    buying_window_score: enrichmentRow?.buying_window_score || "",
    urgency_tier: enrichmentRow?.urgency_tier || "",
    top_signal_keywords: enrichmentRow?.top_signal_keywords || ""
  };

  const contact = {
    contact_name: approvedRow?.buyer_name || "",
    contact_title: approvedRow?.buyer_title || "",
    email: approvedRow?.email || ""
  };

  if (crmName === "hubspot") {
    return exportType === "contact"
      ? {
          firstname: contact.contact_name,
          email: contact.email,
          jobtitle: contact.contact_title,
          associatedcompanyid: company.company_id
        }
      : {
          name: common.company_name,
          domain: common.website,
          industry: common.industry,
          description: common.next_best_action,
          buying_window_score: common.buying_window_score
        };
  }

  if (crmName === "pipedrive") {
    return exportType === "person"
      ? {
          name: contact.contact_name,
          email: contact.email,
          org_id: company.company_id,
          title: contact.contact_title
        }
      : {
          name: common.company_name,
          website: common.website,
          visible_to: 3,
          label: common.urgency_tier
        };
  }

  if (crmName === "close") {
    return exportType === "contact"
      ? {
          name: contact.contact_name,
          emails: contact.email ? [{ email: contact.email }] : [],
          title: contact.contact_title
        }
      : {
          name: common.company_name,
          url: common.website,
          description: common.next_best_action,
          custom: {
            recommended_offer: common.recommended_offer,
            buying_window_score: common.buying_window_score
          }
        };
  }

  return {
    ...common,
    ...contact,
    crm_sync_status: syncRow.sync_status || ""
  };
}

function chooseExportType(crmName, syncRow, settings) {
  if (crmName === "hubspot") {
    return syncRow.crm_record_type === "lead" ? "contact" : "account";
  }
  if (crmName === "pipedrive") {
    return syncRow.crm_record_type === "lead" ? "person" : "organization";
  }
  if (crmName === "close") {
    return syncRow.crm_record_type === "lead" ? "contact" : "lead";
  }
  return settings.crm_export_default_type || "account";
}

export async function runBuildCrmExportReadyJob() {
  const settings = await readSettingsMap(config.sheetTabs.settings);
  const [syncRows, companyRows, enrichmentRows, approvedRows] = await Promise.all([
    readSheet(config.sheetTabs.crmSync),
    readSheet(config.sheetTabs.companyIntel),
    readSheet(config.sheetTabs.enrichmentAddons),
    readSheet(config.sheetTabs.approvedLeads)
  ]);

  const companyMap = new Map(companyRows.map((row) => [row.company_id, row]));
  const enrichmentMap = new Map(enrichmentRows.map((row) => [row.company_id, row]));
  const approvedByLead = new Map(approvedRows.map((row) => [row.lead_id, row]));
  const crmName = settings.crm_default_name || "personal_crm";

  const nextRows = syncRows.map((syncRow) => {
    const company = companyMap.get(syncRow.company_id) || {};
    const enrichment = enrichmentMap.get(syncRow.company_id) || {};
    const approved = approvedByLead.get(syncRow.lead_id) || {};
    const exportType = chooseExportType(crmName, syncRow, settings);
    const payload = buildPayload({
      crmName,
      exportType,
      company,
      syncRow,
      enrichmentRow: enrichment,
      approvedRow: approved
    });

    return {
      export_id: `${crmName}::${syncRow.company_id}::${exportType}`,
      crm_name: crmName,
      export_type: exportType,
      company_id: syncRow.company_id,
      company_name: syncRow.company_name,
      lead_id: syncRow.lead_id,
      contact_name: approved.buyer_name || "",
      email: syncRow.email || "",
      website: company.website || enrichment.primary_domain || "",
      target_payload_json: JSON.stringify(payload),
      export_status:
        syncRow.sync_status === "ready_to_sync" || syncRow.sync_status === "review_for_sync"
          ? "ready"
          : "hold",
      exported_at: "",
      export_note: syncRow.sync_note || company.next_best_action || ""
    };
  });

  await overwriteSheet(config.sheetTabs.crmExportReady, nextRows, crmExportReadyColumns);
  logInfo("Built CRM export-ready rows", {
    crmName,
    exportCount: nextRows.length
  });
}
