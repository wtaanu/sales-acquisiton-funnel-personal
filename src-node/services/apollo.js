import axios from "axios";
import { config } from "../config.js";

function sanitizeDomain(domain) {
  return String(domain || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim();
}

function cleanToken(value) {
  return String(value || "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

function clampPerPage(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return config.apollo.perPage;
  return Math.max(1, Math.min(Math.trunc(number), 100));
}

function normalizeNumber(value) {
  const raw = String(value || "").trim().toUpperCase().replace(/[$,\s]/g, "");
  if (!raw) return "";
  const match = raw.match(/^(\d+(?:\.\d+)?)(K|M|B)?$/);
  if (!match) return raw.replace(/[^0-9.]/g, "");
  const amount = Number(match[1]);
  const multiplier = match[2] === "B" ? 1000000000 : match[2] === "M" ? 1000000 : match[2] === "K" ? 1000 : 1;
  return String(Math.round(amount * multiplier));
}

function normalizeRange(value) {
  const cleaned = cleanToken(value);
  if (!cleaned) return "";
  const parts = cleaned.split(/\s*[-–—]\s*/).map(normalizeNumber).filter(Boolean);
  return parts.length === 2 ? `${parts[0]},${parts[1]}` : cleaned;
}

function normalizeEmailStatus(value) {
  return cleanToken(value).toLowerCase().replace(/\s+/g, "_");
}

export async function fetchApolloPeople(overrides = {}) {
  if (!config.apollo.apiKey) {
    throw new Error("APOLLO_API_KEY is not configured.");
  }

  const targetTitles = Array.isArray(overrides.targetTitles) && overrides.targetTitles.length
    ? overrides.targetTitles
    : config.apollo.targetTitles;
  const targetLocations = Array.isArray(overrides.targetLocations) && overrides.targetLocations.length
    ? overrides.targetLocations
    : config.apollo.targetLocations;
  const emailStatus = Array.isArray(overrides.emailStatus) && overrides.emailStatus.length
    ? overrides.emailStatus
    : config.apollo.emailStatus;
  const includeKeywords = Array.isArray(overrides.includeKeywords) && overrides.includeKeywords.length
    ? overrides.includeKeywords
    : config.apollo.includeKeywords;
  const companySize = Array.isArray(overrides.companySize) ? overrides.companySize.map(normalizeRange).filter(Boolean) : [];
  const excludeKeywords = Array.isArray(overrides.excludeKeywords) ? overrides.excludeKeywords.map(cleanToken).filter(Boolean) : [];
  const revenue = Array.isArray(overrides.revenue) ? overrides.revenue.map(normalizeRange).filter(Boolean) : [];

  const payload = {
    page: Number(overrides.page || config.apollo.page),
    per_page: clampPerPage(overrides.perPage || config.apollo.perPage),
    person_titles: targetTitles.map(cleanToken).filter(Boolean),
    organization_locations: targetLocations,
    contact_email_status: emailStatus.map(normalizeEmailStatus).filter(Boolean),
    q_keywords: includeKeywords.map(cleanToken).filter(Boolean).join(" ")
  };
  if (companySize.length) {
    payload.organization_num_employees_ranges = companySize;
  }
  if (excludeKeywords.length) {
    payload.q_not_keywords = excludeKeywords.join(" ");
  }
  if (revenue.length) {
    payload.organization_revenue_ranges = revenue;
  }

  const response = await axios.post("https://api.apollo.io/api/v1/mixed_people/api_search", payload, {
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": config.apollo.apiKey
    }
  });

  const people = response.data.people || [];
  return people.map((person) => ({
    company_name:
      person.organization?.name ||
      person.account?.name ||
      person.employment_history?.[0]?.organization_name ||
      "",
    country: person.organization?.location || person.country || "",
    industry: person.organization?.industry || person.industry || "",
    employee_count: String(person.organization?.estimated_num_employees || ""),
    funding_stage: person.organization?.latest_funding_round || "",
    recent_signal: [person.headline, "Apollo API prospect"].filter(Boolean).join(" | "),
    hiring_signal: person.title || "",
    tech_stack: person.organization?.technologies?.join(", ") || "",
    pain_notes: person.organization?.short_description || "",
    buyer_name:
      person.first_name || person.last_name
        ? `${person.first_name || ""} ${person.last_name || ""}`.trim()
        : person.name || "",
    buyer_title: person.title || "",
    email: person.email || "",
    website: person.organization?.website_url || sanitizeDomain(person.organization?.primary_domain) || "",
    linkedin_url: person.linkedin_url || "",
    source: "apollo_api"
  }));
}

export async function testApolloApiKey() {
  if (!config.apollo.apiKey) {
    throw new Error("APOLLO_API_KEY is not configured.");
  }

  try {
    const response = await axios.get("https://api.apollo.io/v1/auth/health", {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": config.apollo.apiKey
      }
    });

    return response.data;
  } catch (error) {
    const status = error.response?.status || null;
    const data = error.response?.data || null;
    throw new Error(
      `Apollo auth health failed${status ? ` (status ${status})` : ""}: ${JSON.stringify(data)}`
    );
  }
}

export async function debugApolloPeopleSearch() {
  if (!config.apollo.apiKey) {
    throw new Error("APOLLO_API_KEY is not configured.");
  }

  const payload = {
    page: config.apollo.page,
    per_page: Math.min(config.apollo.perPage, 5),
    person_seniorities: config.apollo.targetTitles,
    organization_locations: config.apollo.targetLocations,
    contact_email_status: config.apollo.emailStatus,
    q_keywords: config.apollo.includeKeywords.join(" ")
  };

  try {
    const response = await axios.post("https://api.apollo.io/api/v1/mixed_people/api_search", payload, {
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.apollo.apiKey
      }
    });

    return {
      status: response.status,
      payload,
      response: response.data
    };
  } catch (error) {
    const status = error.response?.status || null;
    const data = error.response?.data || null;
    throw new Error(
      `Apollo people search failed${status ? ` (status ${status})` : ""}: ${JSON.stringify(data)}`
    );
  }
}
