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

export function classifyReply(replyText) {
  const text = String(replyText || "").toLowerCase();

  if (!text.trim()) {
    return { category: "unclear", sentiment: "neutral", next_action: "Review manually" };
  }

  if (["out of office", "ooo", "on leave", "on vacation", "away from the office"].some((token) => text.includes(token))) {
    return { category: "out_of_office", sentiment: "neutral", next_action: "Pause and follow up later" };
  }

  if (["not interested", "no thanks", "remove me", "unsubscribe", "stop emailing"].some((token) => text.includes(token))) {
    return { category: "not_interested", sentiment: "negative", next_action: "Stop sequence and mark do-not-contact" };
  }

  if (["speak with", "talk to", "reach out to", "contact my", "loop in"].some((token) => text.includes(token))) {
    return { category: "referral", sentiment: "positive", next_action: "Review referral and contact the suggested person" };
  }

  if (["budget", "timing", "already have", "already using", "not a priority", "later", "next quarter"].some((token) => text.includes(token))) {
    return { category: "objection", sentiment: "neutral", next_action: "Respond to objection and keep conversation open" };
  }

  if (text.includes("?") || ["how", "what", "why", "can you", "could you", "send more", "tell me more"].some((token) => text.includes(token))) {
    return { category: "question", sentiment: "positive", next_action: "Answer the question and offer a call" };
  }

  if (["interested", "sounds good", "let's talk", "lets talk", "available", "book", "demo", "chat", "yes"].some((token) => text.includes(token))) {
    return { category: "positive_interest", sentiment: "positive", next_action: "Reply quickly and propose times" };
  }

  return { category: "general_reply", sentiment: "neutral", next_action: "Review and draft a tailored response" };
}

function buildSubject(originalSubject) {
  const clean = String(originalSubject || "").trim();
  return clean.toLowerCase().startsWith("re:") ? clean : `Re: ${clean}`;
}

function salutation(name) {
  return name ? `Hi ${name},` : "Hi,";
}

export function buildSuggestedReply(replyRow, approvedLead) {
  const buyerName = replyRow.buyer_name || approvedLead?.buyer_name || "";
  const offer = approvedLead?.recommended_offer || "workflow improvement";
  const subject = buildSubject(replyRow.subject);
  let body = "";

  switch (replyRow.reply_category) {
    case "positive_interest":
      body = [
        salutation(buyerName),
        "",
        "Thanks for the reply.",
        "",
        `Happy to keep this focused around the ${offer} angle I mentioned and map the bottleneck quickly rather than turn it into a broad discovery exercise.`,
        "",
        "If helpful, I can send a short workflow outline first, or we can do a quick 10-minute call and I'll walk you through the exact fix I'd start with.",
        "",
        "Would one of these work next?",
        "- Tomorrow morning",
        "- Tomorrow afternoon",
        "- The day after",
        "",
        "Warm regards,",
        config.defaultSignatureName,
        config.defaultSignatureCompany
      ].join("\n");
      break;
    case "question":
      body = [
        salutation(buyerName),
        "",
        "Thanks for the question.",
        "",
        `The shortest answer is that I'd keep this focused on one bottleneck first, usually by putting a small operational layer around the ${offer} workflow so the team has less manual back-and-forth and clearer visibility.`,
        "",
        "If you want, send me the specific part of the workflow you want me to look at and I'll reply with a tighter system outline.",
        "",
        "Warm regards,",
        config.defaultSignatureName,
        config.defaultSignatureCompany
      ].join("\n");
      break;
    case "objection":
      body = [
        salutation(buyerName),
        "",
        "That makes sense.",
        "",
        `The reason I reached out was not to suggest a broad automation project, but a narrow fix around the ${offer} workflow that usually pays back quickly when the drag is real.`,
        "",
        "If timing is the main issue, I can send a short workflow map you can keep and revisit later without committing to a call now.",
        "",
        "Warm regards,",
        config.defaultSignatureName,
        config.defaultSignatureCompany
      ].join("\n");
      break;
    case "referral":
      body = [
        salutation(buyerName),
        "",
        "Thanks for pointing me in the right direction.",
        "",
        "I'll keep the outreach concise and centered on the workflow bottleneck we were discussing so it is easy for them to assess quickly.",
        "",
        "Appreciate it.",
        "",
        "Warm regards,",
        config.defaultSignatureName,
        config.defaultSignatureCompany
      ].join("\n");
      break;
    case "out_of_office":
      body = [
        salutation(buyerName),
        "",
        "Thanks for the note.",
        "",
        "I'll follow up again after you're back and keep it brief.",
        "",
        "Warm regards,",
        config.defaultSignatureName,
        config.defaultSignatureCompany
      ].join("\n");
      break;
    default:
      body = [
        salutation(buyerName),
        "",
        "Thanks for getting back to me.",
        "",
        `I'll keep the reply focused on the part of the workflow most relevant to the ${offer} idea, so it is easy to evaluate whether there is a real bottleneck worth fixing.`,
        "",
        "If helpful, I can send a short system outline instead of a longer explanation.",
        "",
        "Warm regards,",
        config.defaultSignatureName,
        config.defaultSignatureCompany
      ].join("\n");
      break;
  }

  const template = fs.readFileSync(templatePath, "utf8");
  const html = fillTemplate(template, {
    logo_url: config.logoUrl,
    buyer_name: buyerName || "there",
    company_name: replyRow.company_name || approvedLead?.company_name || "",
    trigger_signal: "Thanks for the reply.",
    tech_stack: "",
    recommended_offer: approvedLead?.recommended_offer || "Workflow reply",
    pitch_angle: String(replyRow.reply_text || "").slice(0, 280),
    roi_reason: body.split("\n\n").slice(1, 3).join(" "),
    your_name: config.defaultSignatureName
  });

  return {
    suggested_subject: subject,
    suggested_reply_text: body,
    suggested_reply_html: html
  };
}
