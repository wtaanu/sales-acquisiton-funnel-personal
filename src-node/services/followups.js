import { config } from "../config.js";
import {
  inferCompanySizeContext,
  inferIndustryContext,
  inferHowWeHelp,
  inferOutcomeStatement,
  inferPainPointer,
  inferPainHypothesis,
  inferProcessName,
  inferResolutionPointer,
  inferRoleContext
} from "./drafts.js";

export function getFollowupPlan(sendStatus) {
  if (sendStatus === "sent_1") {
    return { draft_type: "followup_1", sequence_step: "2" };
  }
  if (sendStatus === "sent_2") {
    return { draft_type: "followup_2", sequence_step: "3" };
  }
  if (sendStatus === "loom_sent") {
    return { draft_type: "close_loop", sequence_step: "4" };
  }
  return null;
}

export function buildFollowupSubject(lead, sendStatus) {
  const companyName = lead.company_name;
  const title = String(lead.buyer_title || "").toLowerCase();
  const industry = String(lead.industry || "").toLowerCase();

  if (sendStatus === "sent_1") {
    if (lead.recommended_offer === "Lead Response Engine") {
      return `Quick follow-up: plugging the response leak at ${companyName}`;
    }
    if (lead.recommended_offer === "Churn Alert Engine") {
      return `Quick follow-up: protecting ${companyName}'s retention`;
    }
    if (lead.recommended_offer === "Client Intake Engine") {
      return `Quick follow-up: ${companyName} intake process`;
    }
    if (industry.includes("staff") || industry.includes("consult") || industry.includes("logistics")) {
      return `Quick follow-up: reclaiming workflow capacity at ${companyName}`;
    }
    return `Quick follow-up: hidden capacity in ${companyName}'s execution`;
  }

  if (sendStatus === "sent_2") {
    if (["coo", "chief operating officer", "head of operations", "director of operations"].some((token) => title.includes(token))) {
      return `Observations on ${companyName}'s handoff process`;
    }
    if (lead.recommended_offer === "Lead Response Engine") {
      return `A quick idea for tightening ${companyName}'s response flow`;
    }
    if (lead.recommended_offer === "Client Intake Engine") {
      return `A faster intake path for ${companyName}`;
    }
    if (lead.recommended_offer === "Churn Alert Engine") {
      return `Early retention signals inside ${companyName}`;
    }
    return `Observations on ${companyName}'s team friction points`;
  }

  if (lead.recommended_offer === "Lead Response Engine") {
    return `Closing the loop on ${companyName}'s response leak`;
  }
  if (lead.recommended_offer === "Client Intake Engine") {
    return `Closing the loop on ${companyName}'s intake process`;
  }
  if (lead.recommended_offer === "Churn Alert Engine") {
    return `Closing the loop on ${companyName}'s retention signals`;
  }
  return `Closing the loop on ${companyName}'s workflow capacity`;
}

export function buildFollowupText(lead, sendStatus) {
  const painHypothesis = inferPainHypothesis(lead);
  const painPointer = inferPainPointer(lead);
  const processName = inferProcessName(lead);
  const outcomeStatement = inferOutcomeStatement(lead);
  const resolutionPointer = inferResolutionPointer(lead);
  const howWeHelp = inferHowWeHelp(lead);
  const roleContext = inferRoleContext(lead);
  const industryContext = inferIndustryContext(lead);
  const sizeContext = inferCompanySizeContext(lead);

  if (sendStatus === "sent_1") {
    return [
      `Hi ${lead.buyer_name || lead.buyer_title},`,
      "",
      `Following up because ${processName} issues usually become expensive quietly before they become obvious.`,
      "",
      `If I am reading it right, the main pain point is this: ${painPointer}. In ${industryContext.industry_label}s, ${industryContext.industry_pain_frame}. In a ${sizeContext.size_label}, ${sizeContext.size_pain_frame}. For someone focused on ${roleContext.role_focus}, that usually means slower response, weaker handoffs, and extra admin load.`,
      "",
      `The most practical fix is usually ${resolutionPointer}. If useful, I can outline how I would structure a focused ${lead.recommended_offer} around your current setup to create ${outcomeStatement} and help the team ${sizeContext.size_outcome_frame}.`,
      "",
      howWeHelp,
      "",
      "Warm regards,",
      config.defaultSignatureName,
      config.defaultSignatureCompany
    ].join("\n");
  }

  if (sendStatus === "sent_2") {
    return [
      `Hi ${lead.buyer_name || lead.buyer_title},`,
      "",
      `I sketched a short idea for how I would simplify ${lead.company_name}'s ${processName} workflow.`,
      "",
      `It is not a full audit, just a practical system map based on the likelihood that ${painPointer} and ${painHypothesis}. In ${industryContext.industry_label}s, that is usually where pressure builds first for ${roleContext.role_label}s. In a ${sizeContext.size_label}, ${sizeContext.size_pain_frame}.`,
      "",
      `The fix I would explore first is ${resolutionPointer}. ${howWeHelp}`,
      "",
      "If it helps, I can walk you through it in 10 minutes and keep it concrete.",
      "",
      "Warm regards,",
      config.defaultSignatureName,
      config.defaultSignatureCompany
    ].join("\n");
  }

  return [
    `Hi ${lead.buyer_name || lead.buyer_title},`,
    "",
    "I will close the loop after this.",
    "",
    `Reaching out because ${lead.company_name} still looks like a strong fit for a focused ${lead.recommended_offer} if ${processName} is still partly manual. The likely pain point is still ${painPointer}. In ${industryContext.industry_label}s, that kind of drag usually compounds quietly, and in a ${sizeContext.size_label}, ${sizeContext.size_pain_frame}.`,
    "",
    `If it helps, the most practical fix is usually ${resolutionPointer}. ${howWeHelp}`,
    "",
    "If now is not the right time, no worries. If it is, I am happy to map the highest-leverage version first.",
    "",
    "Warm regards,",
    config.defaultSignatureName,
    config.defaultSignatureCompany
  ].join("\n");
}

export function buildFollowupHtml(lead, sendStatus) {
  const text = buildFollowupText(lead, sendStatus).replace(/\n/g, "<br>");
  return `<html><body style="font-family: Arial, Helvetica, sans-serif; color: #1f2937;"><p>${text}</p></body></html>`;
}

export function buildFollowupCta(sendStatus) {
  if (sendStatus === "sent_2") {
    return "Worth a quick 10-minute conversation if I map the system around your workflow?";
  }
  return "If useful, I can send a short system outline tailored to your workflow.";
}
