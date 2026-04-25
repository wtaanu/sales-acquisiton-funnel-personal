import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

const templatePath = path.resolve("templates", "anutechlabs-outreach-email.html");

function fillTemplate(template, replacements) {
  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value ?? ""),
    template
  );
}

function leadText(lead) {
  return [
    lead.recommended_offer,
    lead.industry,
    lead.hiring_signal,
    lead.pain_notes,
    lead.tech_stack,
    lead.buyer_title,
    lead.recent_signal
  ]
    .join(" ")
    .toLowerCase();
}

function numericEmployeeCount(value) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function inferRoleContext(lead) {
  const title = String(lead.buyer_title || "").toLowerCase();

  if (["coo", "chief operating officer", "head of operations", "director of operations", "operations manager"].some((token) => title.includes(token))) {
    return {
      role_label: "operations leader",
      role_focus: "handoffs, visibility, response speed, and operational consistency",
      role_pain_frame: "these issues usually show up first as inconsistent execution, hidden admin load, and weak handoffs across teams"
    };
  }

  if (["customer success", "implementation", "onboarding", "client success"].some((token) => title.includes(token))) {
    return {
      role_label: "customer-facing operator",
      role_focus: "handoffs, onboarding quality, client visibility, and follow-through",
      role_pain_frame: "these issues usually show up as onboarding friction, unclear ownership, and too much manual coordination"
    };
  }

  if (["sales", "revops", "revenue operations", "sales ops"].some((token) => title.includes(token))) {
    return {
      role_label: "revenue operator",
      role_focus: "lead routing, speed to response, and pipeline visibility",
      role_pain_frame: "these issues usually show up as delayed follow-up, weak routing, and good opportunities cooling off too early"
    };
  }

  if (["managing partner", "legal", "partner", "general counsel"].some((token) => title.includes(token))) {
    return {
      role_label: "legal or service leader",
      role_focus: "client intake, information flow, and administrative drag",
      role_pain_frame: "these issues usually show up as intake friction, slower movement from inquiry to action, and too much admin around document flow"
    };
  }

  if (["founder", "ceo", "chief executive officer"].some((token) => title.includes(token))) {
    return {
      role_label: "executive buyer",
      role_focus: "speed, visibility, and leverage without adding headcount",
      role_pain_frame: "these issues usually show up as hidden drag across the team long before they appear clearly in reporting"
    };
  }

  return {
    role_label: "team lead",
    role_focus: "execution speed, clearer ownership, and less manual coordination",
    role_pain_frame: "these issues usually show up as avoidable delays, handoff friction, and repetitive manual work"
  };
}

export function inferIndustryContext(lead) {
  const industry = String(lead.industry || "").toLowerCase();
  const text = leadText(lead);

  if (industry.includes("saas") || industry.includes("software") || industry.includes("enterprise")) {
    return {
      industry_label: "software company",
      industry_focus: "lead flow, onboarding, implementation, and cross-functional handoffs",
      industry_pain_frame: "these teams often feel the drag when lead routing, onboarding, or ownership transitions still depend on too much manual coordination"
    };
  }

  if (industry.includes("legal") || industry.includes("professional")) {
    return {
      industry_label: "legal or professional services team",
      industry_focus: "intake, document flow, approvals, and client coordination",
      industry_pain_frame: "these teams often feel the drag when intake, document movement, and internal approvals are still too admin-heavy"
    };
  }

  if (industry.includes("real estate") || text.includes("property") || text.includes("broker")) {
    return {
      industry_label: "real estate or property operations team",
      industry_focus: "lead response, qualification, follow-up, and multi-step coordination",
      industry_pain_frame: "these teams often feel the drag when inquiries arrive from multiple places and follow-up depends on manual tracking"
    };
  }

  if (industry.includes("health") || text.includes("medical") || text.includes("clinic")) {
    return {
      industry_label: "healthcare or health-tech team",
      industry_focus: "intake, compliance-sensitive workflows, and timely coordination",
      industry_pain_frame: "these teams often feel the drag when intake, coordination, and record movement need speed but are still handled manually"
    };
  }

  return {
    industry_label: "operations-heavy team",
    industry_focus: "cross-team execution, visibility, and repetitive workflow movement",
    industry_pain_frame: "these teams often feel the drag when process steps live across too many tools and too much manual follow-through"
  };
}

export function inferCompanySizeContext(lead) {
  const employees = numericEmployeeCount(lead.employee_count);

  if (employees > 0 && employees <= 25) {
    return {
      size_label: "small growth-stage team",
      size_pain_frame: "the friction usually shows up because a few people are carrying too many workflow steps manually",
      size_outcome_frame: "create leverage without adding headcount too early"
    };
  }

  if (employees >= 26 && employees <= 75) {
    return {
      size_label: "mid-size scaling team",
      size_pain_frame: "the friction usually shows up when handoffs become more frequent but process ownership is still not clean",
      size_outcome_frame: "create cleaner ownership and faster execution as the team scales"
    };
  }

  if (employees >= 76) {
    return {
      size_label: "larger execution-heavy team",
      size_pain_frame: "the friction usually shows up as inconsistent execution across teams, tools, and approval steps",
      size_outcome_frame: "reduce cross-team drag without adding more operational noise"
    };
  }

  return {
    size_label: "growing team",
    size_pain_frame: "the friction usually shows up when process complexity grows faster than workflow design",
    size_outcome_frame: "remove drag before it compounds further"
  };
}

export function inferPainHypothesis(lead) {
  const text = leadText(lead);

  if (text.includes("lead") || text.includes("routing") || text.includes("sales")) {
    return "inbound leads are probably being handled with too much manual routing and inconsistent speed";
  }
  if (text.includes("intake") || text.includes("legal") || text.includes("document")) {
    return "intake and information collection are likely still creating admin drag and delayed handoffs";
  }
  if (text.includes("customer success") || text.includes("onboarding") || text.includes("implementation")) {
    return "customer handoffs and onboarding coordination are likely creating avoidable follow-up and visibility gaps";
  }
  if (text.includes("content") || text.includes("founder") || text.includes("linkedin")) {
    return "valuable founder insight is probably not turning into a repeatable content workflow";
  }
  return "manual operational handoffs are likely creating hidden response delays and extra admin work";
}

export function inferProcessName(lead) {
  const text = leadText(lead);

  if (text.includes("lead") || text.includes("routing") || text.includes("sales")) {
    return "lead response and routing";
  }
  if (text.includes("intake") || text.includes("legal") || text.includes("document")) {
    return "client intake and document collection";
  }
  if (text.includes("customer success") || text.includes("onboarding") || text.includes("implementation")) {
    return "implementation and onboarding handoff";
  }
  if (text.includes("content") || text.includes("founder") || text.includes("linkedin")) {
    return "content production and publishing";
  }
  return "cross-team operational handoff";
}

export function inferOutcomeStatement(lead) {
  const text = leadText(lead);

  if (text.includes("lead") || text.includes("routing") || text.includes("sales")) {
    return "faster response, cleaner routing, and fewer valuable opportunities slipping through";
  }
  if (text.includes("intake") || text.includes("legal") || text.includes("document")) {
    return "less admin effort, cleaner intake, and faster movement from inquiry to qualified case";
  }
  if (text.includes("customer success") || text.includes("onboarding") || text.includes("implementation")) {
    return "fewer handoff gaps, clearer ownership, and smoother onboarding execution";
  }
  if (text.includes("content") || text.includes("founder") || text.includes("linkedin")) {
    return "consistent output without forcing the founder into a constant content bottleneck";
  }
  return "less manual drag, better visibility, and faster execution across the workflow";
}

export function inferPainPointer(lead) {
  const text = leadText(lead);

  if (text.includes("lead") || text.includes("routing") || text.includes("sales")) {
    return "good opportunities may be slowing down between inquiry, qualification, and follow-up";
  }
  if (text.includes("intake") || text.includes("legal") || text.includes("document")) {
    return "intake and information collection may still be creating too much admin effort before real work begins";
  }
  if (text.includes("customer success") || text.includes("onboarding") || text.includes("implementation")) {
    return "handoffs between sales, onboarding, and success may still be too manual and hard to track";
  }
  if (text.includes("content") || text.includes("founder") || text.includes("linkedin")) {
    return "useful insight may exist inside the team, but not in a repeatable system that consistently gets published";
  }
  return "important workflow steps may still rely too much on manual coordination across people and tools";
}

export function inferResolutionPointer(lead) {
  const text = leadText(lead);

  if (text.includes("lead") || text.includes("routing") || text.includes("sales")) {
    return "a tighter qualification, routing, and follow-up workflow";
  }
  if (text.includes("intake") || text.includes("legal") || text.includes("document")) {
    return "a cleaner intake and document workflow with less manual back-and-forth";
  }
  if (text.includes("customer success") || text.includes("onboarding") || text.includes("implementation")) {
    return "a clearer handoff system with better visibility and fewer dropped steps";
  }
  if (text.includes("content") || text.includes("founder") || text.includes("linkedin")) {
    return "a repeatable operating system for turning founder insight into publishable content";
  }
  return "a workflow layer that removes unnecessary handoffs and repetitive manual work";
}

export function inferHowWeHelp(lead) {
  return `Anutech Labs would help by mapping the current bottleneck, designing the smallest useful automation layer first, and keeping the implementation tied to one measurable workflow outcome instead of a broad tool rollout.`;
}

function firstNameOrTitle(lead) {
  return lead.buyer_name || lead.buyer_title || "there";
}

function conciseSignal(lead) {
  const signal = String(lead.recent_signal || "").trim();
  return signal ? `I was reviewing ${lead.company_name} and noticed signals around ${signal.toLowerCase()}.` : `I was reviewing ${lead.company_name}.`;
}

function fitOpener(lead, processName, industryContext, sizeContext) {
  return `Teams in ${industryContext.industry_label} often start feeling drag in ${processName} before it shows up clearly in reporting. In a ${sizeContext.size_label}, ${sizeContext.size_pain_frame}.`;
}

export function buildSubjectLine(lead) {
  const companyName = lead.company_name;
  const title = String(lead.buyer_title || "").toLowerCase();
  const industry = String(lead.industry || "").toLowerCase();

  if (lead.recommended_offer === "Lead Response Engine") {
    return `Plugging the response leak at ${companyName}`;
  }

  if (lead.recommended_offer === "Churn Alert Engine") {
    return `Protecting ${companyName}'s retention (early signals)`;
  }

  if (lead.recommended_offer === "Client Intake Engine") {
    if (industry.includes("legal")) {
      return `A faster intake engine for ${companyName}`;
    }
    return `Question: ${companyName} intake process`;
  }

  if (lead.recommended_offer === "Founder Content Engine") {
    return `${companyName} — hidden capacity in your current execution`;
  }

  if (["coo", "chief operating officer", "head of operations", "director of operations"].some((token) => title.includes(token))) {
    return `Optimizing the ${companyName} handoff process`;
  }

  if (industry.includes("staff") || industry.includes("consult") || industry.includes("logistics")) {
    return `Reclaiming workflow capacity at ${companyName}`;
  }

  if (["founder", "ceo", "chief executive officer", "owner"].some((token) => title.includes(token))) {
    return `${companyName} — hidden capacity in your current execution`;
  }

  return `Observations on ${companyName}'s team friction points`;
}

export function buildEmailBodyText(lead) {
  const painHypothesis = inferPainHypothesis(lead);
  const painPointer = inferPainPointer(lead);
  const processName = inferProcessName(lead);
  const outcomeStatement = inferOutcomeStatement(lead);
  const resolutionPointer = inferResolutionPointer(lead);
  const howWeHelp = inferHowWeHelp(lead);
  const roleContext = inferRoleContext(lead);
  const industryContext = inferIndustryContext(lead);
  const sizeContext = inferCompanySizeContext(lead);
  const opening = conciseSignal(lead);
  const contextLine = fitOpener(lead, processName, industryContext, sizeContext);

  return [
    `Hi ${firstNameOrTitle(lead)},`,
    "",
    opening,
    "",
    contextLine,
    "",
    `The pain point I would pay attention to first is this: ${painPointer}. For someone responsible for ${roleContext.role_focus}, ${roleContext.role_pain_frame}. From the outside, it looks like ${painHypothesis}.`,
    "",
    `The practical fix is usually not a big transformation project. It is a tighter operational layer around ${resolutionPointer}. That is why I would start with a ${lead.recommended_offer}: to create ${outcomeStatement} while helping the team ${sizeContext.size_outcome_frame}.`,
    "",
    howWeHelp,
    "",
    `If helpful, I can send a short system map so you can quickly judge whether this is worth fixing now.`,
    "",
    "Warm regards,",
    config.defaultSignatureName,
    config.defaultSignatureCompany
  ].join("\n");
}

export function buildLoomAngle(lead) {
  return `Show the current workflow bottleneck at ${lead.company_name}, then show how the ${lead.recommended_offer} removes manual steps and speeds up execution.`;
}

export function buildCta() {
  return "Worth a quick 10-minute conversation if I map the system around your current workflow?";
}

export function buildEmailBodyHtml(lead) {
  const template = fs.readFileSync(templatePath, "utf8");
  const openingSignal = conciseSignal(lead);
  const painSummary = `${fitOpener(lead, inferProcessName(lead), inferIndustryContext(lead), inferCompanySizeContext(lead))} The first pain point I would pay attention to is ${inferPainPointer(lead)}.`;
  const helpSummary = `A practical first step would be ${inferResolutionPointer(lead)}. ${inferHowWeHelp(lead)}`;
  return fillTemplate(template, {
    logo_url: config.logoUrl,
    buyer_name: firstNameOrTitle(lead),
    company_name: lead.company_name,
    trigger_signal: openingSignal,
    tech_stack: lead.tech_stack || "",
    recommended_offer: lead.recommended_offer,
    pitch_angle: painSummary,
    roi_reason: helpSummary,
    your_name: config.defaultSignatureName
  });
}
