import { config } from "../config.js";
import { enrichmentAddonColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";
import { logInfo } from "../lib/logger.js";
import { nowIso } from "../lib/time.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function primaryDomain(value) {
  return String(value || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();
}

function extractKeywords(value) {
  return normalizeText(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);
}

function uniqueTop(items, limit = 5) {
  return [...new Set(items.filter(Boolean))].slice(0, limit);
}

function choosePersona(company, approvedRows) {
  const approvedText = approvedRows
    .map((row) => `${row.buyer_title || ""} ${row.buyer_name || ""}`)
    .join(" ")
    .toLowerCase();

  if (approvedText.includes("customer success") || approvedText.includes("implementation")) {
    return "Customer Success / Implementation";
  }
  if (approvedText.includes("operations") || approvedText.includes("revops") || approvedText.includes("coo")) {
    return "Operations";
  }
  if (approvedText.includes("sales")) {
    return "Sales";
  }
  if (approvedText.includes("founder") || approvedText.includes("ceo")) {
    return "Founder / Executive";
  }

  const industry = String(company.industry || "").toLowerCase();
  if (industry.includes("legal")) {
    return "Legal Operations";
  }
  if (industry.includes("staff")) {
    return "Operations";
  }

  return "Operations";
}

function chooseLikelyTeam(company, persona) {
  const industry = String(company.industry || "").toLowerCase();
  if (industry.includes("legal")) {
    return "Legal Ops";
  }
  if (industry.includes("staff")) {
    return "Staffing Operations";
  }
  if (persona.includes("Customer Success")) {
    return "Customer Success";
  }
  if (persona.includes("Sales")) {
    return "Revenue Operations";
  }
  return "Operations";
}

function buildBuyingWindowScore(company, approvedRows) {
  const base = Number(company.highest_lead_score || 0);
  const stageBonus = company.funnel_stage === "engaged" ? 12 : company.funnel_stage === "outreach_active" ? 7 : 0;
  const buyerBonus = approvedRows.length >= 2 ? 6 : approvedRows.length === 1 ? 3 : 0;
  return Math.min(100, base + stageBonus + buyerBonus);
}

function chooseUrgencyTier(score) {
  if (score >= 80) {
    return "hot";
  }
  if (score >= 65) {
    return "warm";
  }
  return "monitor";
}

function buildDataPoints(company, approvedRows) {
  const contact = approvedRows[0];
  const parts = [
    company.latest_signal,
    company.pain_summary,
    company.recommended_offer ? `Best-fit offer: ${company.recommended_offer}` : "",
    contact?.buyer_title ? `Best buyer: ${contact.buyer_title}` : ""
  ].filter(Boolean);
  return uniqueTop(parts, 4).join(" | ");
}

export async function runBuildEnrichmentAddonsJob() {
  const [companyRows, rawRows, approvedRows] = await Promise.all([
    readSheet(config.sheetTabs.companyIntel),
    readSheet(config.sheetTabs.rawLeads),
    readSheet(config.sheetTabs.approvedLeads)
  ]);

  const rawByCompany = rawRows.reduce((map, row) => {
    const list = map.get(row.company_name) || [];
    list.push(row);
    map.set(row.company_name, list);
    return map;
  }, new Map());

  const approvedByCompany = approvedRows.reduce((map, row) => {
    const list = map.get(row.company_name) || [];
    list.push(row);
    map.set(row.company_name, list);
    return map;
  }, new Map());

  const nextRows = companyRows.map((company) => {
    const rawForCompany = rawByCompany.get(company.company_name) || [];
    const approvedForCompany = approvedByCompany.get(company.company_name) || [];
    const persona = choosePersona(company, approvedForCompany);
    const buyingWindowScore = buildBuyingWindowScore(company, approvedForCompany);
    const keywords = uniqueTop(
      rawForCompany.flatMap((row) =>
        extractKeywords(`${row.recent_signal || ""} ${row.hiring_signal || ""} ${row.pain_notes || ""}`)
      ),
      6
    );

    return {
      company_id: company.company_id,
      company_name: company.company_name,
      primary_domain: primaryDomain(company.website),
      primary_persona: persona,
      likely_team: chooseLikelyTeam(company, persona),
      buying_window_score: String(buyingWindowScore),
      urgency_tier: chooseUrgencyTier(buyingWindowScore),
      top_signal_keywords: keywords.join(", "),
      personalized_data_points: buildDataPoints(company, approvedForCompany),
      enrichment_sources: uniqueTop(rawForCompany.map((row) => row.source), 3).join(", "),
      enrich_status: company.latest_signal || company.pain_summary ? "enriched" : "needs_research",
      last_enriched_at: nowIso()
    };
  });

  await overwriteSheet(config.sheetTabs.enrichmentAddons, nextRows, enrichmentAddonColumns);
  logInfo("Built enrichment add-ons", {
    companyCount: nextRows.length
  });
}
