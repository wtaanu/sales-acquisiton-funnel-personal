import { config } from "../config.js";
import { companyIntelColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSettingsMap, readSheet } from "../lib/google-sheets.js";
import { logInfo } from "../lib/logger.js";
import { nowIso } from "../lib/time.js";

function normalizeCompanyName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function sanitizeWebsite(value) {
  return String(value || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();
}

function buildCompanyId({ company_name, website }) {
  const websitePart = sanitizeWebsite(website);
  if (websitePart) {
    return websitePart.replace(/[^a-z0-9.-]/g, "-");
  }

  return normalizeCompanyName(company_name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getBestScoredRow(rows) {
  return [...rows].sort((left, right) => Number(right.lead_score || 0) - Number(left.lead_score || 0))[0] || null;
}

function deriveFunnelStage(approvedRows, highestLeadScore) {
  const statuses = new Set(approvedRows.map((row) => row.send_status).filter(Boolean));
  if (statuses.has("replied")) {
    return "engaged";
  }

  if (statuses.has("sent_2") || statuses.has("sent_1") || statuses.has("loom_sent")) {
    return "outreach_active";
  }

  if (approvedRows.some((row) => row.approval_status === "approved")) {
    return "approved";
  }

  if (highestLeadScore >= 60) {
    return "priority_research";
  }

  if (highestLeadScore >= 35) {
    return "researched";
  }

  return "new";
}

function buildPainSummary(rawRows) {
  const snippets = rawRows
    .map((row) => row.pain_notes || row.recent_signal || row.hiring_signal || "")
    .map((value) => String(value).trim())
    .filter(Boolean);

  return snippets.slice(0, 2).join(" | ");
}

function buildTrendSummary({ industry, highestLeadScore, signalText, recommendedOffer }) {
  const industryLabel = industry || "operations-heavy";
  const scoreLabel =
    highestLeadScore >= 75 ? "high buying intent" : highestLeadScore >= 55 ? "clear process pressure" : "early discovery";
  const signalLabel = signalText || "manual execution drag";
  return `${industryLabel} teams are showing ${scoreLabel}; current signals point to ${signalLabel.toLowerCase()}. Recommended entry point: ${recommendedOffer || "diagnostic workflow audit"}.`;
}

function buildPrediction({ highestLeadScore, funnelStage, recommendedOffer }) {
  if (funnelStage === "engaged") {
    return `Active conversation signals are present. Best move: convert interest into a scoped ${recommendedOffer || "automation"} discussion this week.`;
  }

  if (highestLeadScore >= 75) {
    return `This account is entering a high-probability buying window. A specific ${recommendedOffer || "workflow fix"} pitch should land better than a broad services email.`;
  }

  if (highestLeadScore >= 55) {
    return `This account looks close to automation readiness. A sharper proof-of-pain narrative should unlock replies.`;
  }

  return `This account is still early. More enrichment or a clearer trigger event will improve odds before heavier outreach.`;
}

function buildNextBestAction({ funnelStage, highestLeadScore }) {
  if (funnelStage === "engaged") {
    return "Review replies and prepare a consultative response draft.";
  }

  if (funnelStage === "outreach_active") {
    return "Wait for engagement, then trigger a role-specific follow-up.";
  }

  if (highestLeadScore >= 60) {
    return "Move this account into a priority send batch or Loom-first campaign.";
  }

  return "Enrich the account with stronger signals, list assignment, or buyer context.";
}

export async function runBuildCompanyIntelJob() {
  const settings = await readSettingsMap(config.sheetTabs.settings);
  const [rawRows, scoredRows, approvedRows, watchlistRows] = await Promise.all([
    readSheet(config.sheetTabs.rawLeads),
    readSheet(config.sheetTabs.scoredLeads),
    readSheet(config.sheetTabs.approvedLeads),
    readSheet(config.sheetTabs.watchlists)
  ]);

  const companyMap = new Map();

  for (const row of rawRows) {
    const companyName = normalizeCompanyName(row.company_name);
    if (!companyName) {
      continue;
    }

    const companyId = buildCompanyId(row);
    const entry = companyMap.get(companyId) || {
      company_id: companyId,
      company_name: companyName,
      website: row.website || "",
      country: row.country || "",
      industry: row.industry || "",
      employee_count: row.employee_count || "",
      funding_stage: row.funding_stage || "",
      rawRows: [],
      scoredRows: [],
      approvedRows: [],
      watchlists: []
    };

    entry.rawRows.push(row);
    entry.website ||= row.website || "";
    entry.country ||= row.country || "";
    entry.industry ||= row.industry || "";
    entry.employee_count ||= row.employee_count || "";
    entry.funding_stage ||= row.funding_stage || "";
    companyMap.set(companyId, entry);
  }

  for (const row of scoredRows) {
    const companyId = buildCompanyId(row);
    const entry = companyMap.get(companyId);
    if (!entry) {
      continue;
    }

    entry.scoredRows.push(row);
  }

  for (const row of approvedRows) {
    const companyId = buildCompanyId(row);
    const entry = companyMap.get(companyId);
    if (!entry) {
      continue;
    }

    entry.approvedRows.push(row);
  }

  for (const row of watchlistRows) {
    const companyId = row.company_id || buildCompanyId(row);
    const entry = companyMap.get(companyId);
    if (!entry) {
      continue;
    }

    entry.watchlists.push(row);
  }

  const owner = settings.company_intel_owner || config.defaultSignatureName || "Anuragini Pathak";
  const intelRows = Array.from(companyMap.values())
    .map((entry) => {
      const bestScoredRow = getBestScoredRow(entry.scoredRows);
      const highestLeadScore = Number(bestScoredRow?.lead_score || 0);
      const latestSignal = entry.rawRows
        .map((row) => row.recent_signal || row.hiring_signal || "")
        .find(Boolean) || "";
      const recommendedOffer = bestScoredRow?.recommended_offer || "";
      const funnelStage = deriveFunnelStage(entry.approvedRows, highestLeadScore);
      const savedListNames = entry.watchlists
        .map((row) => row.list_name)
        .filter(Boolean)
        .join(", ");

      return {
        company_id: entry.company_id,
        company_name: entry.company_name,
        website: entry.website,
        country: entry.country,
        industry: entry.industry,
        employee_count: entry.employee_count,
        funding_stage: entry.funding_stage,
        buyer_count: String(
          new Set(entry.rawRows.map((row) => row.email).filter(Boolean)).size
        ),
        lead_count: String(entry.rawRows.length),
        highest_lead_score: String(highestLeadScore || ""),
        recommended_offer: recommendedOffer,
        funnel_stage: funnelStage,
        saved_list_names: savedListNames,
        latest_signal: latestSignal,
        pain_summary: buildPainSummary(entry.rawRows),
        ai_trend_summary: buildTrendSummary({
          industry: entry.industry,
          highestLeadScore,
          signalText: latestSignal,
          recommendedOffer
        }),
        ai_prediction: buildPrediction({
          highestLeadScore,
          funnelStage,
          recommendedOffer
        }),
        next_best_action: buildNextBestAction({
          funnelStage,
          highestLeadScore
        }),
        owner,
        last_enriched_at: nowIso()
      };
    })
    .sort((left, right) => Number(right.highest_lead_score || 0) - Number(left.highest_lead_score || 0));

  await overwriteSheet(config.sheetTabs.companyIntel, intelRows, companyIntelColumns);
  logInfo("Built company intelligence snapshot", {
    companyCount: intelRows.length,
    rawLeadCount: rawRows.length,
    scoredLeadCount: scoredRows.length,
    approvedLeadCount: approvedRows.length
  });
}
