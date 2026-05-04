import { randomUUID } from "crypto";
import { config } from "../config.js";

export const segments = [
  {
    id: "saas_founders",
    label: "SaaS founders",
    targetCount: 100,
    apolloKeywords: "SaaS,software,startup,founder",
    titles: "Founder,CEO,Co-Founder,Head of Sales"
  },
  {
    id: "recruitment_agencies",
    label: "Recruitment agencies",
    targetCount: 100,
    apolloKeywords: "recruitment,staffing,hiring,talent",
    titles: "Founder,CEO,Managing Director,Recruitment Director"
  },
  {
    id: "service_agencies",
    label: "Service agencies",
    targetCount: 100,
    apolloKeywords: "agency,consulting,marketing,services",
    titles: "Founder,CEO,Managing Partner,Owner"
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    targetCount: 100,
    apolloKeywords: "ecommerce,shopify,d2c,retail",
    titles: "Founder,CEO,Head of Growth,Marketing Director"
  },
  {
    id: "real_estate",
    label: "Real estate",
    targetCount: 100,
    apolloKeywords: "real estate,property,brokerage,realtor",
    titles: "Founder,CEO,Broker,Managing Director"
  }
];

export function slugifySegment(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export const mailTypes = [
  { id: "intro_value_prop", label: "Introduction + value prop" },
  { id: "custom_instruction", label: "Custom pasted email logic" },
  { id: "video_link", label: "Video link email" },
  { id: "educational", label: "Educational email" },
  { id: "case_study", label: "Social proof / case study" },
  { id: "free_audit", label: "Free audit CTA" },
  { id: "final_followup", label: "Urgency / final CTA" }
];

const segmentTemplates = {
  saas_founders: {
    problem: "following up with demo requests, trials, and inbound leads consistently",
    value: "an AI follow-up agent that keeps every SaaS lead moving without adding sales admin",
    proof: "SaaS teams usually recover 10+ hours per week and improve reply speed by removing manual follow-up",
    cta: "Worth a quick chat about where your current sales process is leaking time?"
  },
  recruitment_agencies: {
    problem: "candidate/client coordination, reminders, and interview scheduling",
    value: "an AI hiring coordination agent that automates scheduling, reminders, and status updates",
    proof: "agencies can handle more placements with the same recruiters when coordination work is automated",
    cta: "Want me to map where automation could save the most time in your hiring process?"
  },
  service_agencies: {
    problem: "manual follow-up, proposal creation, and inconsistent lead-to-close movement",
    value: "an AI sales workflow agent that qualifies, follows up, and prepares proposal-ready context",
    proof: "service agencies usually win by improving follow-up consistency before buying more leads",
    cta: "Open to a short audit of your lead-to-close workflow?"
  },
  ecommerce: {
    problem: "support, abandoned interest, Meta/Instagram leads, and customer re-engagement",
    value: "AI agents for lead response, DM handling, repeat purchase nudges, and content repurposing",
    proof: "e-commerce teams can convert more of the traffic they already paid for by reducing response gaps",
    cta: "Worth exploring one automation that can recover more revenue from existing traffic?"
  },
  real_estate: {
    problem: "slow response to buyer, seller, tenant, and investor enquiries",
    value: "an AI real estate lead agent that qualifies interest, follows up, and books calls or visits",
    proof: "real estate conversion often improves when every enquiry gets fast qualification and next-step reminders",
    cta: "Want me to show where an AI agent could help your property lead flow?"
  },
  general_b2b: {
    problem: "manual prospecting, follow-ups, and CRM updates",
    value: "a custom AI agent that removes repetitive admin from your sales workflow",
    proof: "most teams can reclaim hours every week by automating the boring but important steps",
    cta: "Worth a quick audit?"
  }
};

export function isWeekend(date = new Date()) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function getSegmentTemplate(segment) {
  return segmentTemplates[segment] || segmentTemplates.general_b2b;
}

function parseDraftInstruction(value = "") {
  const text = String(value || "").trim();
  if (!text) {
    return {
      subject: "",
      videoUrl: "",
      freeAuditUrl: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/free-audit` : "https://anutechlabs.company/free-audit",
      theme: "",
      notes: ""
    };
  }

  const subjectMatch = text.match(/subject:\s*([^\n]+)/i);
  const urls = [...text.matchAll(/https?:\/\/[^\s)]+/gi)].map((match) => match[0].replace(/[.,;]+$/, ""));
  const videoUrl = urls.find((url) => /youtu\.?be|youtube\.com/i.test(url)) || "";
  const freeAuditUrl = urls.find((url) => /free-audit/i.test(url)) || (process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/free-audit` : "https://anutechlabs.company/free-audit");
  const lower = text.toLowerCase();
  const theme = lower.includes("salespeople") || lower.includes("salespeople are leaving") || lower.includes("turnover")
    ? "sales retention and reducing admin load for good salespeople"
    : lower.includes("video")
      ? "short educational video"
      : "";

  return {
    subject: subjectMatch?.[1]?.trim() || "",
    videoUrl,
    freeAuditUrl,
    theme,
    notes: text
      .replace(/subject:\s*[^\n]+/i, "")
      .replace(/hi\s+\[name\],?/i, "")
      .replace(/warm regards[\s\S]*/i, "")
      .trim()
  };
}

function replacePlaceholders(text, { firstName, company, prospect, calendarLink, freeAuditUrl }) {
  const name = firstName && firstName !== "there" ? firstName : "there";
  return String(text || "")
    .replace(/\{\{\s*first_name\s*\}\}/gi, name)
    .replace(/\{\{\s*name\s*\}\}/gi, name)
    .replace(/\[Name\]/g, name)
    .replace(/\{\{\s*company\s*\}\}/gi, company)
    .replace(/\[Company\]/g, company)
    .replace(/\{\{\s*company_name\s*\}\}/gi, company)
    .replace(/\{\{\s*industry\s*\}\}/gi, prospect.industry || "your industry")
    .replace(/\{\{\s*title\s*\}\}/gi, prospect.buyer_title || "your role")
    .replace(/\{\{\s*calendar_link\s*\}\}/gi, calendarLink || "")
    .replace(/\[Calendar link\]/g, calendarLink || "[Calendar link]")
    .replace(/\{\{\s*free_audit_url\s*\}\}/gi, freeAuditUrl || "https://anutechlabs.company/free-audit");
}

function buildCustomInstructionBody({ firstName, company, prospect, draftInstruction, calendarLink }) {
  const instruction = parseDraftInstruction(draftInstruction);
  const freeAuditUrl = instruction.freeAuditUrl || "https://anutechlabs.company/free-audit";
  const cleaned = instruction.notes || String(draftInstruction || "").trim();
  const withoutSubject = cleaned
    .replace(/subject:\s*[^\n]+/i, "")
    .replace(/thanks\s*&\s*regards[\s\S]*/i, "")
    .replace(/warm regards[\s\S]*/i, "")
    .trim();
  const body = withoutSubject || "I wanted to share a quick idea on how automation can reduce manual sales work and recover missed opportunities.";
  const personalized = replacePlaceholders(body, { firstName, company, prospect, calendarLink, freeAuditUrl });

  return [
    personalized.match(/^hi\s+/i) ? personalized : `Hi ${firstName},\n\n${personalized}`,
    "",
    "Thanks & Regards,",
    "AI SDR- Anutech Labs",
    "Website: https://anutechlabs.company/"
  ].join("\n").replace(/\n{3,}/g, "\n\n");
}

function buildInstructionAwareBody({ firstName, company, template, mailType, sequenceStep, calendarLink, draftInstruction }) {
  const instruction = parseDraftInstruction(draftInstruction);
  const isVideo = mailType === "video_link" || Boolean(instruction.videoUrl);
  const theme = instruction.theme || "sales automation";
  const freeAuditUrl = instruction.freeAuditUrl || "https://anutechlabs.company/free-audit";
  const videoUrl = instruction.videoUrl;

  if (isVideo) {
    return [
      `Hi ${firstName},`,
      "",
      `Quick question: how much time is ${company}'s sales team losing to admin instead of selling?`,
      "",
      "Most sales teams do not lose good opportunities because the team is not capable. They lose them because follow-ups, CRM updates, lead entry, and reminders quietly eat the week.",
      "",
      videoUrl
        ? `I recorded a short video on this exact problem: ${videoUrl}`
        : "I recorded a short video on this exact problem and how automation can reduce the admin load.",
      "",
      `The useful idea is simple: protect your best salespeople from repetitive work so they can spend more time selling, following up faster, and keeping every opportunity visible.`,
      "",
      `If you want to see your specific opportunity, you can run the free audit here: ${freeAuditUrl}`,
      "",
      sequenceStep >= 3
        ? `If it makes sense to talk after that, here is the booking link: ${calendarLink || "[Calendar link]"}`
        : template.cta,
      "",
      "Warm regards,",
      config.defaultSignatureName || "Anuragini Pathak",
      config.defaultSignatureCompany || "Anutech Labs"
    ].join("\n");
  }

  const educationLine = mailType === "educational" ? "\nThe most useful pattern I am seeing: automate the handoff first, then optimize acquisition spend." : "";
  const proofLine = ["case_study", "final_followup"].includes(mailType) ? `\nA similar team used this approach because ${template.proof.toLowerCase()}.` : "";
  const auditLine = mailType === "free_audit" ? `\nI can run a free audit and show exactly where automation would help first: ${freeAuditUrl}` : "";

  return [
    `Hi ${firstName},`,
    "",
    `I was looking at ${company} and noticed you may be dealing with ${template.problem}.`,
    "",
    `That is exactly where ${template.value} can help.${educationLine}${proofLine}${auditLine}`,
    "",
    `The goal is simple: fewer missed opportunities, faster follow-up, and a cleaner system your team can actually track.`,
    "",
    theme ? `The angle I would focus on first is ${theme}.` : "",
    theme ? "" : "",
    sequenceStep >= 3
      ? `I am keeping this as my last note. If useful, here is the booking link: ${calendarLink || "[Calendar link]"}`
      : template.cta,
    "",
    "Warm regards,",
    config.defaultSignatureName || "Anuragini Pathak",
    config.defaultSignatureCompany || "Anutech Labs"
  ].filter((line, index, all) => line || all[index - 1]).join("\n");
}

export function buildCampaignDraft(prospect, { mailType = "intro_value_prop", sequenceStep = 1, calendarLink = process.env.DEFAULT_MEETING_URL || "", draftInstruction = "" } = {}) {
  const segment = prospect.segment || "general_b2b";
  const template = getSegmentTemplate(segment);
  const firstName = prospect.buyer_name || "there";
  const company = prospect.company_name || "your company";
  const processName = template.problem;
  const instruction = parseDraftInstruction(draftInstruction);

  const subjects = {
    intro_value_prop: `Quick thought on ${company}'s workflow`,
    custom_instruction: instruction.subject || `Quick idea for ${company}`,
    video_link: instruction.subject || `Short video idea for ${company}`,
    educational: `A useful automation idea for ${company}`,
    case_study: `Re: ${company}'s workflow`,
    free_audit: `Free audit for ${company}`,
    final_followup: "Last message"
  };

  const text = mailType === "custom_instruction"
    ? buildCustomInstructionBody({ firstName, company, prospect, draftInstruction, calendarLink })
    : buildInstructionAwareBody({ firstName, company, template, mailType, sequenceStep, calendarLink, draftInstruction });

  const html = text
    .split("\n")
    .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : "<br />"))
    .join("");

  return {
    draftId: `sales-${prospect.lead_id}-${mailType}-${sequenceStep}-${randomUUID().slice(0, 8)}`,
    subjectLine: subjects[mailType] || subjects.intro_value_prop,
    emailBodyText: text,
    emailBodyHtml: html,
    previewHtml: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:640px">${html}<p style="font-size:12px;color:#6b7280">AI SDR by AnutechLabs · <a href="${process.env.NEXT_PUBLIC_SITE_URL || ""}/unsubscribe">Unsubscribe</a></p></div>`,
    personalization: {
      name: firstName,
      company,
      processName,
      pain: processName,
      segment,
      mailType,
      instruction: {
        subject: instruction.subject,
        videoUrl: instruction.videoUrl,
        freeAuditUrl: instruction.freeAuditUrl,
        theme: instruction.theme
      }
    }
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char));
}
