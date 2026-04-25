function numericEmployeeCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function scoreBudget(lead) {
  let score = 0;
  const country = (lead.country || "").toLowerCase();
  const employees = numericEmployeeCount(lead.employee_count);
  const fundingStage = (lead.funding_stage || "").toLowerCase();

  if (["united states", "usa", "us", "united kingdom", "uk"].includes(country)) {
    score += 15;
  }
  if (employees >= 15 && employees <= 60) {
    score += 20;
  } else if ((employees >= 8 && employees < 15) || (employees >= 61 && employees <= 100)) {
    score += 10;
  }
  if (["seed", "series a", "series b", "private"].includes(fundingStage)) {
    score += 15;
  }
  if (!country && /\.[a-z]{2,}$/.test((lead.email || "").toLowerCase())) {
    score += 5;
  }
  if (!employees && (lead.company_name || "").trim()) {
    score += 5;
  }
  return score;
}

function scoreUrgency(lead) {
  const text = `${lead.recent_signal || ""} ${lead.hiring_signal || ""}`.toLowerCase();
  let score = 0;

  if (["funding", "raised", "growth", "expanding"].some((token) => text.includes(token))) {
    score += 15;
  }
  if (
    ["sales ops", "revops", "operations", "customer success", "marketing ops"].some((token) =>
      text.includes(token)
    )
  ) {
    score += 15;
  }
  if (["hiring", "job post", "opening"].some((token) => text.includes(token))) {
    score += 10;
  }
  return score;
}

function scoreFit(lead) {
  const text = `${lead.industry || ""} ${lead.tech_stack || ""} ${lead.pain_notes || ""}`.toLowerCase();
  let score = 0;

  if (["saas", "law", "legal", "real estate"].some((token) => text.includes(token))) {
    score += 10;
  }
  if (["hubspot", "salesforce", "slack", "whatsapp", "crm", "zapier"].some((token) => text.includes(token))) {
    score += 15;
  }
  if (
    ["manual", "slow", "spreadsheet", "handoff", "inbound", "intake", "follow-up"].some((token) =>
      text.includes(token)
    )
  ) {
    score += 20;
  }
  if (
    ["automation", "implement", "integration", "migration", "operations", "workflow", "redlining"].some((token) =>
      text.includes(token)
    )
  ) {
    score += 15;
  }
  return score;
}

function scoreBuyer(lead) {
  const title = (lead.buyer_title || "").toLowerCase();
  if (["job application", "jobs", "applicant"].some((token) => title.includes(token))) {
    return -8;
  }
  if (["ceo", "founder", "coo", "cro", "cto", "head"].some((token) => title.includes(token))) {
    return 15;
  }
  if (["director", "manager", "lead"].some((token) => title.includes(token))) {
    return 8;
  }
  if (["consultant", "engineer", "specialist", "operations", "success"].some((token) => title.includes(token))) {
    return 5;
  }
  return 0;
}

export function scoreLead(lead) {
  const budget_score = scoreBudget(lead);
  const urgency_score = scoreUrgency(lead);
  const fit_score = scoreFit(lead);
  const buyer_score = scoreBuyer(lead);
  const title = (lead.buyer_title || "").toLowerCase();
  const qualificationNotes = [];

  if (["job application", "jobs", "applicant"].some((token) => title.includes(token))) {
    qualificationNotes.push("Contact looks job-post or applicant oriented, not a clean buyer profile.");
  }
  if (["ceo", "founder", "coo", "cro", "cto", "head", "director", "manager", "lead"].some((token) => title.includes(token))) {
    qualificationNotes.push("Role shows some seniority signal.");
  }
  if ((lead.industry || "").toLowerCase().includes("enterprise")) {
    qualificationNotes.push("Enterprise or operations-heavy context may fit process automation.");
  }

  return {
    budget_score,
    urgency_score,
    fit_score,
    buyer_score,
    lead_score: budget_score + urgency_score + fit_score + buyer_score,
    qualification_notes: qualificationNotes.join(" ")
  };
}
