import { config } from "../config.js";
import { watchlistColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSettingsMap, readSheet } from "../lib/google-sheets.js";
import { logInfo } from "../lib/logger.js";

function parseList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function containsAny(haystack, needles) {
  if (!needles.length) {
    return true;
  }

  const normalized = normalize(haystack);
  return needles.some((needle) => normalized.includes(needle));
}

function matchesSearch(company, search) {
  const geographies = parseList(search.target_geographies);
  const industries = parseList(search.target_industries);
  const titles = parseList(search.target_titles);
  const signals = parseList(search.target_signals);

  const companyText = [
    company.company_name,
    company.industry,
    company.latest_signal,
    company.pain_summary,
    company.ai_trend_summary,
    company.ai_prediction,
    company.recommended_offer
  ].join(" ");

  const geographyMatch = !geographies.length || geographies.some((entry) => normalize(company.country).includes(entry));
  const industryMatch = !industries.length || industries.some((entry) => normalize(company.industry).includes(entry));
  const titleMatch = titles.length ? containsAny(companyText, titles) : false;
  const signalMatch = signals.length ? containsAny(companyText, signals) : false;
  const queryKeywords = parseList(
    String(search.query_text || "")
      .replace(/\|/g, ",")
      .replace(/\s+/g, ",")
  );
  const queryMatch = queryKeywords.length ? containsAny(companyText, queryKeywords) : false;
  const scoreMatch = Number(company.highest_lead_score || 0) >= 70;

  return geographyMatch && industryMatch && (signalMatch || queryMatch || titleMatch || scoreMatch);
}

function derivePriority(company) {
  const score = Number(company.highest_lead_score || 0);
  if (score >= 75) {
    return "high";
  }
  if (score >= 60) {
    return "medium";
  }
  return "low";
}

function deriveStage(company) {
  if (company.funnel_stage === "engaged") {
    return "engaged";
  }
  if (company.funnel_stage === "outreach_active") {
    return "outreach_active";
  }
  if (Number(company.highest_lead_score || 0) >= 60) {
    return "priority";
  }
  return "tracking";
}

export async function runBuildWatchlistsJob() {
  const settings = await readSettingsMap(config.sheetTabs.settings);
  const [companyRows, savedSearchRows, existingWatchlistRows] = await Promise.all([
    readSheet(config.sheetTabs.companyIntel),
    readSheet(config.sheetTabs.savedSearches),
    readSheet(config.sheetTabs.watchlists)
  ]);

  const existingMap = new Map(
    existingWatchlistRows.map((row) => [`${row.list_name}::${row.company_id}`, row])
  );

  const owner = settings.company_intel_owner || config.defaultSignatureName || "Anuragini Pathak";
  const nextRows = [];

  for (const search of savedSearchRows.filter((row) => normalize(row.status) === "active")) {
    for (const company of companyRows) {
      if (!matchesSearch(company, search)) {
        continue;
      }

      const key = `${search.search_name}::${company.company_id}`;
      const existing = existingMap.get(key) || {};

      nextRows.push({
        watchlist_id: existing.watchlist_id || `${search.search_id || normalize(search.search_name).replace(/[^a-z0-9]/g, "-")}::${company.company_id}`,
        list_name: search.search_name || settings.default_watchlist_name || "Priority Accounts",
        company_id: company.company_id,
        company_name: company.company_name,
        website: company.website,
        priority: existing.priority || derivePriority(company),
        stage: existing.stage || deriveStage(company),
        owner: existing.owner || owner,
        alert_status: existing.alert_status || "active",
        last_signal_at: company.last_enriched_at || "",
        next_action: company.next_best_action || existing.next_action || "Review company intelligence and decide the next move.",
        notes: existing.notes || company.ai_prediction || ""
      });
    }
  }

  nextRows.sort((left, right) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return (priorityOrder[right.priority] || 0) - (priorityOrder[left.priority] || 0);
  });

  await overwriteSheet(config.sheetTabs.watchlists, nextRows, watchlistColumns);
  logInfo("Built watchlists from saved searches", {
    savedSearchCount: savedSearchRows.filter((row) => normalize(row.status) === "active").length,
    matchedCompanies: nextRows.length
  });
}
