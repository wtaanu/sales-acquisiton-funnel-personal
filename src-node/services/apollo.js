import axios from "axios";
import { config } from "../config.js";

function sanitizeDomain(domain) {
  return String(domain || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim();
}

export async function fetchApolloPeople() {
  if (!config.apollo.apiKey) {
    throw new Error("APOLLO_API_KEY is not configured.");
  }

  const payload = {
    page: config.apollo.page,
    per_page: config.apollo.perPage,
    person_seniorities: config.apollo.targetTitles,
    organization_locations: config.apollo.targetLocations,
    contact_email_status: config.apollo.emailStatus,
    q_keywords: config.apollo.includeKeywords.join(" ")
  };

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
