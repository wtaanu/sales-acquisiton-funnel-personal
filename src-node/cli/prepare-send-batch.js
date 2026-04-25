import fs from "node:fs";
import path from "node:path";
import { outreachDraftColumns } from "../constants/sheetColumns.js";
import { overwriteSheet, readSheet } from "../lib/google-sheets.js";
import { config } from "../config.js";

const templatePath = path.resolve("templates", "anutechlabs-outreach-email.html");

const batchProfiles = {
  "prenuvo-travis-montera-prenuvo-com": {
    subject: "Prenuvo: intake and approvals drag?",
    intro: "I was reviewing Prenuvo and the way legal, intake, and approvals usually intersect in healthcare-heavy teams.",
    pain:
      "The pain point I would pay attention to first is this: contract, intake, and approval steps often create more internal back-and-forth than they should, which slows decisions and adds hidden admin load.",
    resolution:
      "The practical fix is usually a tighter intake and approval workflow that captures the right information earlier, routes it cleanly, and removes avoidable chasing across teams.",
    help:
      "Anutech Labs would help by mapping the current approval path, identifying where the drag is building, and implementing a focused intake workflow that shortens handoffs without adding more operational noise."
  },
  "original-software-klamb-originalsoftware-com": {
    subject: "Original Software: churn risk signal?",
    intro: "I was reviewing Original Software and thinking about where customer-success teams start feeling operational drag first.",
    pain:
      "The pain point I would pay attention to first is this: renewal risk and client frustration often stay fragmented across emails, calls, and internal notes until they become visible too late.",
    resolution:
      "The practical fix is usually an early-warning layer that surfaces churn signals sooner, gives the team clearer visibility, and makes follow-up more consistent before an account slips.",
    help:
      "Anutech Labs would help by mapping the current customer-success workflow, defining the risk signals worth tracking, and setting up a lightweight alert system tied to one measurable retention outcome."
  },
  "tavily-din-tavily-com": {
    subject: "Tavily: onboarding coordination gap?",
    intro: "I was reviewing Tavily and the kind of handoff pressure that builds when onboarding and customer-success ownership are still too manual.",
    pain:
      "The pain point I would pay attention to first is this: handoffs between sales, onboarding, and success can easily create unclear ownership, slower response times, and avoidable follow-up gaps for the client.",
    resolution:
      "The practical fix is usually a clearer onboarding handoff system with structured triggers, ownership visibility, and fewer manual status checks across the team.",
    help:
      "Anutech Labs would help by mapping the current onboarding path, identifying where ownership becomes fuzzy, and implementing a focused handoff layer that makes the workflow easier to track and execute."
  },
  "software-professionals--inc--reena-spius-net": {
    subject: "Software Professionals, Inc.: intake friction?",
    intro: "I was reviewing Software Professionals, Inc. and the type of intake drag that often starts building inside founder-led delivery teams.",
    pain:
      "The pain point I would pay attention to first is this: inquiries, project intake, and internal qualification often create too much back-and-forth before real work even begins, which quietly slows delivery.",
    resolution:
      "The practical fix is usually a tighter intake workflow that structures information earlier, cuts repetitive clarification, and moves work forward with less admin overhead.",
    help:
      "Anutech Labs would help by mapping the current intake path, identifying the points where time is being lost, and implementing a practical intake layer that improves speed without forcing a big systems overhaul."
  },
  "empower-associates-dan-empowerassociates-com": {
    subject: "Empower Associates: cross-team handoff drag?",
    intro: "I was reviewing Empower Associates and the kind of execution drag that tends to show up when teams rely on too many manual handoffs.",
    pain:
      "The pain point I would pay attention to first is this: cross-team coordination often depends on people remembering the next step, which creates visibility gaps, slower response, and extra follow-up work for leadership.",
    resolution:
      "The practical fix is usually a workflow layer that tightens handoffs, makes ownership clearer, and removes repetitive coordination work from the day-to-day operation.",
    help:
      "Anutech Labs would help by mapping the current handoff flow, identifying the manual steps that are leaking time, and implementing a focused operating layer that improves execution consistency."
  },
  "ak-operations-amy-akoperations-com": {
    subject: "AK Operations: intake friction?",
    intro: "I was reviewing AK Operations and the kind of admin drag that builds when a growing team is still carrying intake and follow-through manually.",
    pain:
      "The pain point I would pay attention to first is this: important work often starts with scattered intake, repetitive clarification, and too much manual follow-up before ownership is truly clear.",
    resolution:
      "The practical fix is usually a cleaner intake workflow that captures the right inputs early, routes them with less ambiguity, and shortens the distance between inquiry and action.",
    help:
      "Anutech Labs would help by mapping the current intake path, simplifying the points where things stall, and implementing a focused workflow layer that reduces admin effort and speeds up execution."
  },
  "apn-consulting--inc--vedant-apnconsultinginc-com": {
    subject: "APN Consulting, Inc.: intake friction?",
    intro: "I was reviewing APN Consulting, Inc. and the kind of intake complexity that often appears in consulting and delivery-led businesses.",
    pain:
      "The pain point I would pay attention to first is this: early-stage intake and qualification can end up scattered across emails, calls, and spreadsheets, which slows response and creates avoidable operational drag.",
    resolution:
      "The practical fix is usually a tighter intake and qualification workflow that standardizes the front end, reduces admin effort, and makes the next step obvious for the team.",
    help:
      "Anutech Labs would help by mapping the current front-end workflow, identifying the manual choke points, and implementing a focused intake system that improves speed and consistency."
  },
  "focus-technology-consulting-llangston-focustech-com": {
    subject: "Focus Technology Consulting: intake friction?",
    intro: "I was reviewing Focus Technology Consulting and the kind of workflow drag that often shows up when client intake and delivery prep still rely on manual coordination.",
    pain:
      "The pain point I would pay attention to first is this: client intake, internal qualification, and document collection can quietly create too much back-and-forth before delivery work starts.",
    resolution:
      "The practical fix is usually a cleaner intake workflow with better structure upfront, fewer manual follow-ups, and clearer handoff into delivery.",
    help:
      "Anutech Labs would help by mapping the current intake path, identifying where the admin burden is building, and implementing a focused workflow layer that removes friction without disrupting delivery."
  },
  "saas-consulting-group-rob-gottschalk-saascg-com": {
    subject: "SaaS Consulting Group: intake friction?",
    intro: "I was reviewing SaaS Consulting Group and the kind of front-end process drag that can build in founder-led consulting teams.",
    pain:
      "The pain point I would pay attention to first is this: intake, qualification, and early client coordination often become more manual than they look, which slows response and adds unnecessary admin effort.",
    resolution:
      "The practical fix is usually a tighter intake and routing workflow that captures the right details earlier and reduces back-and-forth before delivery starts.",
    help:
      "Anutech Labs would help by mapping the current client-entry process, identifying the repeated manual steps, and implementing a focused intake layer that improves speed and consistency."
  },
  "trulegal--formerly-tru-staffing--jared-trustaffingpartners-com": {
    subject: "TruLegal: intake friction?",
    intro: "I was reviewing TruLegal and the kind of intake and document-flow drag that often builds in legal and staffing-heavy service operations.",
    pain:
      "The pain point I would pay attention to first is this: intake, information gathering, and approvals often stay too admin-heavy for too long, which slows movement and creates unnecessary follow-up work.",
    resolution:
      "The practical fix is usually a cleaner intake and document workflow that structures information earlier, reduces repeated chasing, and makes the next step easier for the team.",
    help:
      "Anutech Labs would help by mapping the current intake flow, identifying where the process is becoming heavy, and implementing a practical workflow layer that improves speed without forcing a broad rebuild."
  }
};

function fillTemplate(template, replacements) {
  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, value ?? ""),
    template
  );
}

function buildTextBody(row, profile) {
  const salutation = row.buyer_name || row.buyer_title || "there";
  return [
    `Hi ${salutation},`,
    "",
    profile.intro,
    "",
    profile.pain,
    "",
    profile.resolution,
    "",
    profile.help,
    "",
    "If useful, I can map a short system outline around your current workflow so you can quickly judge whether the bottleneck is worth fixing.",
    "",
    "Warm regards,",
    config.defaultSignatureName,
    config.defaultSignatureCompany
  ].join("\n");
}

function buildHtmlBody(row, profile) {
  const template = fs.readFileSync(templatePath, "utf8");
  return fillTemplate(template, {
    logo_url: config.logoUrl,
    buyer_name: row.buyer_name || row.buyer_title || "there",
    company_name: row.company_name,
    trigger_signal: profile.intro,
    tech_stack: "",
    recommended_offer: row.recommended_offer,
    pitch_angle: profile.pain,
    roi_reason: `${profile.resolution} ${profile.help}`,
    your_name: config.defaultSignatureName
  });
}

async function main() {
  const rows = await readSheet(config.sheetTabs.outreachDrafts);
  const selectedLeadIds = new Set(Object.keys(batchProfiles));
  const latestInitialDraftAtByLead = new Map();

  for (const row of rows) {
    if (row.draft_type !== "initial" || !selectedLeadIds.has(row.lead_id)) {
      continue;
    }
    const currentBest = latestInitialDraftAtByLead.get(row.lead_id);
    const currentStamp = row.drafted_at || "";
    if (!currentBest || currentStamp >= currentBest) {
      latestInitialDraftAtByLead.set(row.lead_id, currentStamp);
    }
  }

  const updatedRows = rows.flatMap((row) => {
    const isInitial = row.draft_type === "initial";
    const isSelected = selectedLeadIds.has(row.lead_id);
    const latestDraftAt = latestInitialDraftAtByLead.get(row.lead_id);
    const isChosenSelectedDraft =
      Boolean(latestDraftAt) && isInitial && isSelected && row.drafted_at === latestDraftAt;

    if (!isInitial) {
      if (row.draft_status === "reviewed") {
        return [{ ...row, draft_status: "ready" }];
      }
      return [row];
    }

    if (!isSelected) {
      if (row.draft_status === "reviewed") {
        return [{ ...row, draft_status: "ready" }];
      }
      return [row];
    }

    if (isSelected && !isChosenSelectedDraft) {
      return [];
    }

    const profile = batchProfiles[row.lead_id];
    return [{
      ...row,
      subject_line: profile.subject,
      email_body_text: buildTextBody(row, profile),
      email_body_html: buildHtmlBody(row, profile),
      cta: "Worth a quick 10-minute conversation if I map the system around your current workflow?",
      draft_status: "reviewed",
      signature_name: config.defaultSignatureName,
      signature_company: config.defaultSignatureCompany
    }];
  });

  await overwriteSheet(config.sheetTabs.outreachDrafts, updatedRows, outreachDraftColumns);
  console.log(
    JSON.stringify(
      {
        preparedLeadCount: selectedLeadIds.size,
        reviewedDrafts: updatedRows.filter(
          (row) => row.draft_type === "initial" && row.draft_status === "reviewed"
        ).length
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
