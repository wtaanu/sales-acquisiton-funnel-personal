import { createClient } from "@supabase/supabase-js";

function createSharedClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false
    }
  });
}

const supabase = createSharedClient();

export function getSharedSupabaseClient() {
  return supabase;
}

export function isSharedSupabaseConfigured() {
  return Boolean(supabase);
}

export async function logSharedJobRun(input) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("client_acquisition_job_runs")
    .insert({
      job_name: input.jobName,
      script_name: input.scriptName || null,
      status: input.status,
      exit_code: input.exitCode ?? null,
      stdout: input.stdout?.slice(0, 12000) || null,
      stderr: input.stderr?.slice(0, 12000) || null,
      source: "my_sales_tool",
      started_at: input.startedAt || new Date().toISOString(),
      finished_at: input.finishedAt || new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Supabase job log failed", error.message);
    return null;
  }

  return data;
}

export async function upsertSharedDraft(input) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("client_acquisition_outreach_drafts")
    .upsert(
      {
        draft_id: input.draftId,
        lead_id: input.leadId || null,
        draft_source: input.draftSource,
        source_record_id: input.sourceRecordId,
        company_name: input.companyName || null,
        buyer_name: input.buyerName || null,
        buyer_title: input.buyerTitle || null,
        email: input.email,
        recommended_offer: input.recommendedOffer || null,
        subject_line: input.subjectLine,
        email_body_text: input.emailBodyText || null,
        email_body_html: input.emailBodyHtml || null,
        draft_status: input.draftStatus || "ready",
        send_result: input.sendResult || null,
        sent_at: input.sentAt || null,
        drafted_at: input.draftedAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "draft_id" }
    )
    .select("id")
    .single();

  if (error) {
    console.warn("Supabase draft upsert failed", error.message);
    return null;
  }

  return data;
}

export async function logSharedSendEvent(input) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("client_acquisition_email_events")
    .insert({
      draft_id: input.draftId || null,
      draft_source: input.draftSource,
      source_record_id: input.sourceRecordId || null,
      email: input.email,
      subject_line: input.subjectLine || null,
      event_type: input.eventType,
      provider_message_id: input.providerMessageId || null,
      detail: input.detail || null,
      created_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    console.warn("Supabase send event failed", error.message);
    return null;
  }

  return data;
}

export async function upsertSalesProspect(input) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("sales_prospects")
    .upsert(
      {
        lead_id: input.lead_id,
        segment: input.segment || inferSegment(input),
        company_name: input.company_name || null,
        buyer_name: input.buyer_name || null,
        buyer_title: input.buyer_title || null,
        email: input.email,
        country: input.country || null,
        industry: input.industry || null,
        employee_count: input.employee_count || null,
        website: input.website || null,
        linkedin_url: input.linkedin_url || null,
        source: input.source || "apollo_client_acquisition",
        recent_signal: input.recent_signal || null,
        pain_notes: input.pain_notes || null,
        tech_stack: input.tech_stack || null,
        recommended_offer: input.recommended_offer || null,
        pitch_angle: input.pitch_angle || null,
        roi_reason: input.roi_reason || null,
        lead_score: numberOrNull(input.lead_score),
        budget_score: numberOrNull(input.budget_score),
        urgency_score: numberOrNull(input.urgency_score),
        fit_score: numberOrNull(input.fit_score),
        buyer_score: numberOrNull(input.buyer_score),
        verification_status: input.verification_status || null,
        verification_sub_status: input.verification_sub_status || null,
        verification_notes: input.verification_notes || null,
        prospect_status: input.prospect_status || statusFromProspect(input),
        raw_payload: input.raw_payload || input,
        updated_at: new Date().toISOString()
      },
      { onConflict: "lead_id" }
    )
    .select("*")
    .single();

  if (error) {
    console.warn("Supabase prospect upsert failed", error.message);
    return null;
  }

  return data;
}

export async function createSalesEmailDraft(input) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("sales_email_drafts")
    .upsert(
      {
        draft_id: input.draftId,
        campaign_id: input.campaignId || null,
        prospect_id: input.prospectId,
        lead_id: input.leadId,
        segment: input.segment,
        mail_type: input.mailType,
        sequence_step: input.sequenceStep || 1,
        personalization: input.personalization || {},
        subject_line: input.subjectLine,
        email_body_text: input.emailBodyText,
        email_body_html: input.emailBodyHtml,
        preview_html: input.previewHtml || input.emailBodyHtml,
        draft_status: input.draftStatus || "ready",
        updated_at: new Date().toISOString()
      },
      { onConflict: "draft_id" }
    )
    .select("*")
    .single();

  if (error) {
    console.warn("Supabase sales draft upsert failed", error.message);
    return null;
  }

  return data;
}

export async function getSalesDashboardData() {
  if (!supabase) {
    return {
      prospects: [],
      drafts: [],
      replies: [],
      stats: {},
      error: "Shared Supabase is not configured."
    };
  }

  const [prospects, drafts, replies, events, customSegments] = await Promise.all([
    supabase.from("sales_prospects").select("*").order("updated_at", { ascending: false }).limit(200),
    supabase.from("sales_email_drafts").select("*, sales_prospects(company_name,buyer_name,email,industry,segment,prospect_status,followup_count)").order("updated_at", { ascending: false }).limit(100),
    supabase.from("sales_inbox_replies").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("client_acquisition_email_events").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("sales_segments").select("*").eq("is_active", true).order("created_at", { ascending: false })
  ]);

  const prospectSegments = Object.values((prospects.data || []).reduce((acc, prospect) => {
    const segment = prospect.segment || "general_b2b";
    if (!acc[segment]) {
      acc[segment] = {
        id: segment,
        label: segment
          .split(/[_-]+/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
        targetCount: 0,
        apolloKeywords: prospect.industry || segment,
        titles: prospect.buyer_title || ""
      };
    }
    acc[segment].targetCount += 1;
    if (prospect.buyer_title && !String(acc[segment].titles || "").includes(prospect.buyer_title)) {
      acc[segment].titles = [acc[segment].titles, prospect.buyer_title].filter(Boolean).join(",");
    }
    return acc;
  }, {}));

  return {
    prospects: prospects.data || [],
    drafts: drafts.data || [],
    replies: replies.data || [],
    events: events.data || [],
    customSegments: customSegments.data || [],
    prospectSegments,
    stats: summarizeSalesFunnel(prospects.data || [], drafts.data || [], replies.data || [], events.data || []),
    error: prospects.error?.message || drafts.error?.message || replies.error?.message || events.error?.message || customSegments.error?.message || ""
  };
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function statusFromProspect(input) {
  if (input.unsubscribed_at) return "unsubscribed";
  if (input.replied_at) return "replied";
  if (input.verification_status === "approved_for_review" || input.verification_status === "manual_review") return "verified";
  if (input.lead_score) return "scored";
  return "new";
}

function inferSegment(input) {
  const text = `${input.industry || ""} ${input.company_name || ""} ${input.buyer_title || ""} ${input.pain_notes || ""}`.toLowerCase();
  if (/saas|software|founder/.test(text)) return "saas_founders";
  if (/recruit|staffing|hiring/.test(text)) return "recruitment_agencies";
  if (/agency|service|consult/.test(text)) return "service_agencies";
  if (/e-?commerce|shopify|retail|d2c/.test(text)) return "ecommerce";
  if (/real estate|property|broker/.test(text)) return "real_estate";
  return "general_b2b";
}

function summarizeSalesFunnel(prospects, drafts, replies, events) {
  const byStatus = prospects.reduce((acc, row) => {
    acc[row.prospect_status || "unknown"] = (acc[row.prospect_status || "unknown"] || 0) + 1;
    return acc;
  }, {});
  const bySegment = prospects.reduce((acc, row) => {
    acc[row.segment || "unknown"] = (acc[row.segment || "unknown"] || 0) + 1;
    return acc;
  }, {});

  return {
    totalProspects: prospects.length,
    readyDrafts: drafts.filter((draft) => draft.draft_status === "ready").length,
    reviewedDrafts: drafts.filter((draft) => draft.draft_status === "reviewed").length,
    sentEvents: events.filter((event) => event.event_type === "sent").length,
    replies: replies.length,
    byStatus,
    bySegment
  };
}
