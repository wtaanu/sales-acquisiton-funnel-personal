function leadText(lead) {
  return [
    lead.company_name,
    lead.industry,
    lead.recent_signal,
    lead.hiring_signal,
    lead.tech_stack,
    lead.pain_notes,
    lead.buyer_title
  ]
    .join(" ")
    .toLowerCase();
}

function keywordScore(text, keywords) {
  return keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
}

function countMatches(text, keywords) {
  return keywords.filter((keyword) => text.includes(keyword)).length;
}

function scoreOffer(text, offer) {
  let score = keywordScore(text, offer.keywords || []) * (offer.keywordWeight || 1);

  if (offer.priorityBoost) {
    score += offer.priorityBoost;
  }

  if (offer.requireAny?.length && !offer.requireAny.some((keyword) => text.includes(keyword))) {
    score -= offer.requirePenalty || 0;
  }

  if (offer.requireAll?.length && !offer.requireAll.every((keyword) => text.includes(keyword))) {
    score -= offer.requirePenalty || 0;
  }

  if (offer.strongSignals?.length) {
    score += countMatches(text, offer.strongSignals) * (offer.strongSignalWeight || 0);
  }

  if (offer.weakSignals?.length) {
    score -= countMatches(text, offer.weakSignals) * (offer.weakSignalPenalty || 0);
  }

  return score;
}

const offers = [
  {
    name: "Lead Response Engine",
    pitch_angle: "Qualify, route, and respond to valuable leads before they go cold.",
    roi_reason: "Cuts response delays and improves pipeline conversion without adding headcount.",
    keywordWeight: 3,
    strongSignalWeight: 3,
    requirePenalty: 4,
    keywords: [
      "lead",
      "routing",
      "crm",
      "sales",
      "revops",
      "sales ops",
      "response",
      "inbound",
      "follow-up",
      "pipeline"
    ],
    strongSignals: ["speed to lead", "lead routing", "inbound lead", "pipeline"],
    weakSignals: ["content", "linkedin"]
  },
  {
    name: "Client Intake Engine",
    pitch_angle: "Turn messy intake into a structured, AI-assisted workflow.",
    roi_reason: "Reduces admin handling time and prevents incomplete or slow intake follow-up.",
    keywordWeight: 3,
    strongSignalWeight: 3,
    requirePenalty: 4,
    keywords: [
      "intake",
      "client",
      "case",
      "consultation",
      "form",
      "legal",
      "document",
      "approval",
      "onboarding",
      "application"
    ],
    strongSignals: ["document collection", "client intake", "case intake", "consultation"],
    weakSignals: ["linkedin", "content"]
  },
  {
    name: "Churn Alert Engine",
    pitch_angle: "Detect renewal risk and client dissatisfaction before revenue walks out.",
    roi_reason: "Saving even one high-value client can cover the implementation cost quickly.",
    keywordWeight: 3,
    strongSignalWeight: 3,
    requirePenalty: 5,
    keywords: [
      "customer success",
      "support",
      "renewal",
      "churn",
      "retention",
      "customer",
      "client success",
      "escalation",
      "complaint"
    ],
    strongSignals: ["renewal", "retention", "customer success"],
    weakSignals: ["content", "linkedin", "job application"]
  },
  {
    name: "Founder Content Engine",
    pitch_angle: "Convert founder insight into a repeatable weekly content machine.",
    roi_reason: "Replaces inconsistent posting with a structured system that compounds credibility.",
    keywordWeight: 4,
    strongSignalWeight: 4,
    requireAny: ["content", "linkedin", "loom", "thought leadership", "personal brand", "audience"],
    requirePenalty: 12,
    keywords: [
      "linkedin",
      "content",
      "loom",
      "social",
      "thought leadership",
      "personal brand",
      "audience"
    ],
    strongSignals: ["founder-led marketing", "founder brand", "content engine"],
    weakSignals: ["implementation", "intake", "renewal", "migration"]
  },
  {
    name: "Ops Bridge Engine",
    pitch_angle: "Connect fragmented tools so operations stop leaking time through manual work.",
    roi_reason: "Eliminates repetitive handoffs and reduces spreadsheet-driven operational drag.",
    keywordWeight: 1,
    strongSignalWeight: 1,
    requireAny: ["integration", "migration", "handoff", "spreadsheet", "manual", "workflow", "process", "coordination"],
    requirePenalty: 2,
    keywords: [
      "workflow",
      "operations",
      "implementation",
      "integration",
      "migration",
      "handoff",
      "manual",
      "spreadsheet",
      "coordination",
      "process"
    ],
    strongSignals: ["api", "integration", "migration", "handoff", "spreadsheet"],
    weakSignals: ["linkedin", "content", "renewal", "customer success"]
  }
];

export function recommendOffer(lead) {
  const text = leadText(lead);
  const scored = offers.map((offer) => ({
    ...offer,
    score: scoreOffer(text, offer)
  }));

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  if (best.score > 0) {
    return {
      recommended_offer: best.name,
      pitch_angle: best.pitch_angle,
      roi_reason: best.roi_reason
    };
  }

  return {
    recommended_offer: "Ops Bridge Engine",
    pitch_angle: "Connect fragmented tools so operations stop leaking time through manual work.",
    roi_reason: "Eliminates repetitive handoffs and reduces spreadsheet-driven operational drag."
  };
}
