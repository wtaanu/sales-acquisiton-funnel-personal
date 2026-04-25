import { config } from "../config.js";
import { alertColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSettingsMap, readSheet } from "../lib/google-sheets.js";
import { logInfo } from "../lib/logger.js";
import { nowIso } from "../lib/time.js";

function buildAlertId(companyId, alertType) {
  return `${companyId}-${alertType}`;
}

function buildCurrentAlertRows(companyIntelRows, watchlistRows, settings) {
  const now = nowIso();
  const minimumScore = Number(settings.alert_minimum_score || 60);
  const watchlisted = new Set(
    watchlistRows
      .filter((row) => row.alert_status !== "muted")
      .map((row) => row.company_id || row.company_name)
      .filter(Boolean)
  );

  const alerts = [];

  for (const company of companyIntelRows) {
    const companyId = company.company_id || company.company_name;
    const score = Number(company.highest_lead_score || 0);
    const isWatchlisted = watchlisted.has(companyId) || watchlisted.has(company.company_name);

    if (score >= minimumScore) {
      alerts.push({
        alert_id: buildAlertId(companyId, "high-score"),
        company_id: companyId,
        company_name: company.company_name,
        alert_type: "high-score",
        alert_title: `${company.company_name} is entering a likely buying window`,
        alert_detail: `Highest lead score is ${score}. ${company.ai_prediction || company.next_best_action || ""}`.trim(),
        severity: score >= 75 ? "high" : "medium",
        status: "open",
        created_at: now,
        recommended_action: company.next_best_action || "Review this account for the next send batch."
      });
    }

    if (company.funnel_stage === "engaged") {
      alerts.push({
        alert_id: buildAlertId(companyId, "engaged"),
        company_id: companyId,
        company_name: company.company_name,
        alert_type: "engaged",
        alert_title: `${company.company_name} has live engagement signals`,
        alert_detail: "Reply handling or meeting conversion should be prioritized before new outbound.",
        severity: "high",
        status: "open",
        created_at: now,
        recommended_action: "Review inbound activity and respond with a consultative next step."
      });
    }

    if (isWatchlisted && score < minimumScore) {
      alerts.push({
        alert_id: buildAlertId(companyId, "watchlist-enrichment"),
        company_id: companyId,
        company_name: company.company_name,
        alert_type: "watchlist-enrichment",
        alert_title: `${company.company_name} needs stronger enrichment`,
        alert_detail: "The account is being tracked, but the score is still below the action threshold.",
        severity: "low",
        status: "open",
        created_at: now,
        recommended_action: "Add stronger hiring, funding, or workflow signals before pushing harder."
      });
    }
  }

  return alerts;
}

export async function runGenerateAccountAlertsJob() {
  const settings = await readSettingsMap(config.sheetTabs.settings);
  const [companyIntelRows, watchlistRows, existingAlertRows] = await Promise.all([
    readSheet(config.sheetTabs.companyIntel),
    readSheet(config.sheetTabs.watchlists),
    readSheet(config.sheetTabs.alerts)
  ]);

  const preservedResolvedAlerts = existingAlertRows.filter((row) => row.status === "resolved");
  const generatedAlerts = buildCurrentAlertRows(companyIntelRows, watchlistRows, settings);
  const nextRows = [...generatedAlerts, ...preservedResolvedAlerts];

  await overwriteSheet(config.sheetTabs.alerts, nextRows, alertColumns);
  logInfo("Generated account alerts", {
    openAlertCount: generatedAlerts.length,
    resolvedAlertCount: preservedResolvedAlerts.length
  });
}
