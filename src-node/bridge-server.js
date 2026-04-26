import http from "http";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { config } from "./config.js";
import { outreachDraftColumns } from "./constants/sheetColumns.js";
import { appendRows, readSheet } from "./lib/google-sheets.js";
import { nowIso } from "./lib/time.js";
import { canSendEmail, createTransport, sendMail } from "./services/smtp.js";
import { canSendWithResend, sendResendMail } from "./services/resend.js";
import {
  createSalesEmailDraft,
  getSalesDashboardData,
  getSharedSupabaseClient,
  isSharedSupabaseConfigured,
  logSharedJobRun,
  logSharedSendEvent,
  upsertSalesProspect,
  upsertSharedDraft
} from "./services/shared-supabase.js";
import { buildCampaignDraft, isWeekend, mailTypes, segments, slugifySegment } from "./services/sales-campaigns.js";

function resolvePort() {
  const rawPort = process.env.PORT || process.env.CLIENT_ACQUISITION_BRIDGE_PORT || "4100";
  const port = Number(rawPort);
  return Number.isInteger(port) && port >= 0 && port < 65536 ? port : 4100;
}

const PORT = resolvePort();

const allowedJobs = new Map([
  ["import-leads", "run:import"],
  ["score-leads", "run:score"],
  ["verify-emails", "run:verify"],
  ["generate-drafts", "run:drafts"],
  ["review-next-50", "review:next"],
  ["send-reviewed-drafts", "run:send"],
  ["generate-followups", "run:followups"],
  ["read-inbox-replies", "run:replies"],
  ["sync-crm-records", "run:crm"],
  ["weekly-report", "run:report"]
]);

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function runNpmScript(script, args = []) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", script, ...args], {
      cwd: process.cwd(),
      shell: true,
      env: process.env
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function buildDraftRow(input) {
  const source = input.source || "ai_sdr";
  const sourceRecordId = input.sourceRecordId || randomUUID();
  const lead = input.lead || {};
  const draftId = input.draftId || `${source}-${sourceRecordId}`;
  const enriched = {
    lead_id: lead.leadId || draftId,
    draft_id: draftId,
    draft_type: input.draftType || "initial",
    sequence_step: input.sequenceStep || "1",
    company_name: lead.company || "AnutechLabs Website Lead",
    buyer_name: lead.name || lead.firstName || "there",
    buyer_title: lead.title || "",
    email: lead.email,
    recommended_offer: input.recommendedOffer || "AI SDR by AnutechLabs",
    parent_send_status: "not_sent",
    subject_line: input.subject,
    email_body_text: input.text,
    email_body_html: input.html || "",
    loom_angle: input.loomAngle || "",
    cta: input.cta || "Book a consultation",
    signature_name: config.defaultSignatureName,
    signature_company: config.defaultSignatureCompany,
    logo_mode: config.logoMode,
    logo_url: config.logoUrl,
    draft_source: source,
    source_record_id: sourceRecordId,
    draft_status: input.draftStatus || "ready",
    send_result: "",
    sent_at: "",
    drafted_at: nowIso()
  };

  return outreachDraftColumns.map((column) => enriched[column] ?? "");
}

function buildDraftPayload(input) {
  const source = input.source || "ai_sdr";
  const sourceRecordId = input.sourceRecordId || randomUUID();
  const lead = input.lead || {};
  const draftId = input.draftId || `${source}-${sourceRecordId}`;

  return {
    draftId,
    leadId: lead.leadId || draftId,
    draftSource: source,
    sourceRecordId,
    companyName: lead.company || "AnutechLabs Website Lead",
    buyerName: lead.name || lead.firstName || "there",
    buyerTitle: lead.title || "",
    email: lead.email,
    recommendedOffer: input.recommendedOffer || "AI SDR by AnutechLabs",
    subjectLine: input.subject,
    emailBodyText: input.text,
    emailBodyHtml: input.html || "",
    draftStatus: input.draftStatus || "ready",
    sendResult: input.sendResult || "",
    sentAt: input.sentAt || null,
    draftedAt: nowIso()
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char));
}

function applyRecipientVariables(value, recipient = {}) {
  const firstName = recipient.firstName || recipient.name?.split(" ")[0] || "there";
  return String(value || "")
    .replaceAll("{{first_name}}", firstName)
    .replaceAll("{{name}}", recipient.name || firstName)
    .replaceAll("{{company}}", recipient.company || "your business")
    .replaceAll("{{country}}", recipient.country || "");
}

function brandEmailHtml({ html, text, recipient }) {
  const bodyHtml = html
    ? applyRecipientVariables(html, recipient)
    : applyRecipientVariables(text, recipient)
        .split("\n")
        .map((line) => (line ? `<p>${escapeHtml(line)}</p>` : "<br />"))
        .join("");
  const logoBlock = config.logoUrl
    ? `<img src="${escapeHtml(config.logoUrl)}" alt="Anutech Labs" style="height:48px;max-width:180px;object-fit:contain" />`
    : `<div style="font-size:22px;font-weight:800;color:#f97316;letter-spacing:.3px">Anutech Labs</div>`;

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#111827">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
            <tr>
              <td style="background:#0f172a;padding:22px 26px;border-bottom:4px solid #f97316">
                ${logoBlock}
                <div style="margin-top:8px;color:#cbd5e1;font-size:13px">AI SDR by Anutech Labs</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 26px;font-size:15px;line-height:1.7;color:#1f2937">
                ${bodyHtml}
                <p style="margin-top:28px">Thanks &amp; Regards,<br /><strong>AI SDR- Anutech Labs</strong><br />Website: <a href="https://anutechlabs.company/" style="color:#f97316;font-weight:700;text-decoration:none">https://anutechlabs.company/</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function brandEmailText(text, recipient) {
  const replaced = applyRecipientVariables(text, recipient);
  const cleaned = replaced.replace(/Thanks\s*&\s*Regards[\s\S]*$/i, "").trim();
  return `${cleaned}

Thanks & Regards
AI SDR- Anutech Labs
Website: https://anutechlabs.company/`;
}

function smtpHealthSummary() {
  return {
    configured: canSendEmail(),
    hostConfigured: Boolean(config.smtp.host),
    host: config.smtp.host || "",
    port: config.smtp.port,
    secure: config.smtp.secure,
    userConfigured: Boolean(config.smtp.user),
    fromEmailConfigured: Boolean(config.smtp.fromEmail),
    replyToConfigured: Boolean(config.smtp.replyTo),
    tlsRejectUnauthorized: config.smtp.tlsRejectUnauthorized
  };
}

function emailProviderSummary() {
  return {
    activeProvider: canSendWithResend() ? "resend" : canSendEmail() ? "smtp" : "none",
    resendReady: canSendWithResend(),
    resendFromEmailConfigured: Boolean(config.resend.fromEmail),
    smtpReady: canSendEmail(),
    smtp: smtpHealthSummary()
  };
}

async function sendTransactionalMail(message) {
  if (canSendWithResend()) {
    return sendResendMail(message);
  }
  return sendMail(message);
}

async function mirrorSheetProspectsToSupabase() {
  const [rawRows, scoredRows, approvedRows] = await Promise.all([
    readSheet(config.sheetTabs.rawLeads).catch(() => []),
    readSheet(config.sheetTabs.scoredLeads).catch(() => []),
    readSheet(config.sheetTabs.approvedLeads).catch(() => [])
  ]);
  const byLeadId = new Map();

  for (const row of rawRows) byLeadId.set(row.lead_id, { ...row, prospect_status: "new" });
  for (const row of scoredRows) byLeadId.set(row.lead_id, { ...(byLeadId.get(row.lead_id) || {}), ...row, prospect_status: "scored" });
  for (const row of approvedRows) byLeadId.set(row.lead_id, { ...(byLeadId.get(row.lead_id) || {}), ...row, prospect_status: "verified" });

  const rows = Array.from(byLeadId.values()).filter((row) => row.lead_id && row.email);
  const results = await Promise.all(rows.map((row) => upsertSalesProspect(row)));
  return results.filter(Boolean).length;
}

async function handleRequest(request, response) {
  if (request.method === "OPTIONS") {
    return json(response, 204, {});
  }

  if (request.method === "GET" && request.url === "/api/version") {
    return json(response, 200, {
      ok: true,
      service: "anutechlabs-client-acquisition-bridge",
      version: "2026-04-26-resend-send-email",
      routes: [
        "GET /api/health",
        "GET /api/email-diagnostics",
        "GET /api/smtp-diagnostics",
        "GET /api/sales-dashboard",
        "POST /api/send-email",
        "POST /api/jobs/run",
        "POST /api/segments",
        "POST /api/prospects/migrate-sheets",
        "POST /api/prospects/generate",
        "POST /api/campaigns/generate-drafts",
        "POST /api/drafts/review",
        "POST /api/drafts/send"
      ]
    });
  }

  if (request.method === "GET" && request.url === "/api/health") {
    const [drafts] = await Promise.all([readSheet(config.sheetTabs.outreachDrafts).catch(() => [])]);
    return json(response, 200, {
      ok: true,
      service: "anutechlabs-client-acquisition-bridge",
      smtpReady: canSendEmail(),
      emailProvider: emailProviderSummary(),
      smtp: smtpHealthSummary(),
      sharedSupabaseReady: isSharedSupabaseConfigured(),
      outreachDraftCount: drafts.length,
      sheetTabs: config.sheetTabs,
      checkedAt: nowIso()
    });
  }

  if (request.method === "GET" && request.url === "/api/email-diagnostics") {
    return json(response, 200, {
      ok: canSendWithResend() || canSendEmail(),
      ...emailProviderSummary(),
      checkedAt: nowIso()
    });
  }

  if (request.method === "GET" && request.url === "/api/smtp-diagnostics") {
    if (!canSendEmail()) {
      return json(response, 500, {
        ok: false,
        smtp: smtpHealthSummary(),
        error: "SMTP environment variables are incomplete."
      });
    }

    try {
      const transporter = createTransport();
      await transporter.verify();
      return json(response, 200, {
        ok: true,
        smtp: smtpHealthSummary(),
        detail: "SMTP authentication and connection verified."
      });
    } catch (error) {
      return json(response, 500, {
        ok: false,
        smtp: smtpHealthSummary(),
        error: error instanceof Error ? error.message : "SMTP verification failed.",
        code: error && typeof error === "object" && "code" in error ? error.code : undefined,
        command: error && typeof error === "object" && "command" in error ? error.command : undefined,
        response: error && typeof error === "object" && "response" in error ? error.response : undefined
      });
    }
  }

  if (request.method === "GET" && request.url === "/api/sales-dashboard") {
    const dashboard = await getSalesDashboardData();
    const allSegments = [
      ...segments,
      ...(dashboard.customSegments || []).map((segment) => ({
        id: segment.segment_id,
        label: segment.label,
        targetCount: segment.target_count,
        apolloKeywords: segment.apollo_keywords,
        titles: segment.target_titles
      }))
    ];
    return json(response, dashboard.error ? 500 : 200, {
      ok: !dashboard.error,
      segments: allSegments,
      mailTypes,
      weekendSendingBlocked: isWeekend(),
      ...dashboard
    });
  }

  if (request.method === "POST" && request.url === "/api/segments") {
    const body = await readBody(request);
    const supabase = getSharedSupabaseClient();
    if (!supabase) return json(response, 500, { error: "Shared Supabase is not configured." });

    const label = String(body.label || "").trim();
    if (!label) return json(response, 400, { error: "Segment label is required." });

    const segmentId = body.segmentId || slugifySegment(label);
    const { data, error } = await supabase
      .from("sales_segments")
      .upsert(
        {
          segment_id: segmentId,
          label,
          target_count: Number(body.targetCount || 100),
          apollo_keywords: body.apolloKeywords || "",
          target_titles: body.targetTitles || "",
          target_locations: body.targetLocations || "",
          notes: body.notes || "",
          is_active: true,
          updated_at: nowIso()
        },
        { onConflict: "segment_id" }
      )
      .select("*")
      .single();

    return json(response, error ? 500 : 200, error ? { error: error.message } : { ok: true, segment: data });
  }

  if (request.method === "POST" && request.url === "/api/prospects/migrate-sheets") {
    const count = await mirrorSheetProspectsToSupabase();
    return json(response, 200, { ok: true, count });
  }

  if (request.method === "POST" && request.url === "/api/prospects/generate") {
    const body = await readBody(request);
    const jobs = body.mode === "existing"
      ? []
      : ["import-leads", "score-leads", "verify-emails"];
    const runResults = [];

    for (const job of jobs) {
      const script = allowedJobs.get(job);
      const startedAt = nowIso();
      const result = await runNpmScript(script);
      await logSharedJobRun({
        jobName: job,
        scriptName: script,
        status: result.code === 0 ? "completed" : "failed",
        exitCode: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
        startedAt,
        finishedAt: nowIso()
      });
      runResults.push({ job, ...result });
      if (result.code !== 0) break;
    }

    const migrated = await mirrorSheetProspectsToSupabase();
    return json(response, 200, { ok: true, mode: body.mode || "new", jobs: runResults, migrated });
  }

  if (request.method === "POST" && request.url === "/api/campaigns/generate-drafts") {
    const body = await readBody(request);
    const supabase = getSharedSupabaseClient();
    if (!supabase) return json(response, 500, { error: "Shared Supabase is not configured." });

    const segment = body.segment || "saas_founders";
    const mailType = body.mailType || "intro_value_prop";
    const sourceList = body.sourceList || "existing";
    const limit = Math.min(Number(body.limit || 50), 100);

    if (sourceList === "new") {
      await runNpmScript(allowedJobs.get("import-leads"));
      await runNpmScript(allowedJobs.get("score-leads"));
      await runNpmScript(allowedJobs.get("verify-emails"));
      await mirrorSheetProspectsToSupabase();
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("sales_campaigns")
      .insert({
        name: `${segment} - ${mailType} - ${new Date().toISOString().slice(0, 10)}`,
        segment,
        mail_type: mailType,
        status: "draft",
        target_count: limit
      })
      .select("*")
      .single();
    if (campaignError) return json(response, 500, { error: campaignError.message });

    const { data: prospects, error: prospectError } = await supabase
      .from("sales_prospects")
      .select("*")
      .eq("segment", segment)
      .in("prospect_status", sourceList === "followup" ? ["sent", "followup_due"] : ["verified", "scored", "new"])
      .is("unsubscribed_at", null)
      .is("replied_at", null)
      .lt("followup_count", 3)
      .order("lead_score", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (prospectError) return json(response, 500, { error: prospectError.message });

    const drafts = [];
    for (const prospect of prospects || []) {
      const sequenceStep = sourceList === "followup" ? Math.min((prospect.followup_count || 0) + 2, 3) : 1;
      const draft = buildCampaignDraft(prospect, { mailType, sequenceStep });
      const saved = await createSalesEmailDraft({
        ...draft,
        campaignId: campaign.id,
        prospectId: prospect.id,
        leadId: prospect.lead_id,
        segment,
        mailType,
        sequenceStep,
        draftStatus: "ready"
      });
      if (saved) drafts.push(saved);
    }

    return json(response, 200, { ok: true, campaign, draftsCreated: drafts.length, drafts });
  }

  if (request.method === "POST" && request.url === "/api/drafts/review") {
    const body = await readBody(request);
    const supabase = getSharedSupabaseClient();
    if (!supabase) return json(response, 500, { error: "Shared Supabase is not configured." });
    const { data, error } = await supabase
      .from("sales_email_drafts")
      .update({
        subject_line: body.subjectLine,
        email_body_text: body.emailBodyText,
        email_body_html: body.emailBodyHtml,
        preview_html: body.previewHtml || body.emailBodyHtml,
        draft_status: body.status || "reviewed",
        review_notes: body.reviewNotes || null,
        updated_at: nowIso()
      })
      .eq("id", body.draftId)
      .select("*")
      .single();
    return json(response, error ? 500 : 200, error ? { error: error.message } : { ok: true, draft: data });
  }

  if (request.method === "POST" && request.url === "/api/drafts/send") {
    const body = await readBody(request);
    const supabase = getSharedSupabaseClient();
    if (!supabase) return json(response, 500, { error: "Shared Supabase is not configured." });
    if (isWeekend() && !body.overrideWeekend) {
      return json(response, 409, { error: "Weekend sending is blocked. Warm outreach sends only Monday-Friday." });
    }
    if (!canSendWithResend() && !canSendEmail()) return json(response, 500, { error: "No email provider is configured." });

    const { data: draft, error } = await supabase
      .from("sales_email_drafts")
      .select("*, sales_prospects(*)")
      .eq("id", body.draftId)
      .single();
    if (error || !draft) return json(response, 404, { error: error?.message || "Draft not found." });
    if (!["reviewed", "ready"].includes(draft.draft_status)) return json(response, 400, { error: "Draft is not ready for sending." });
    const prospect = Array.isArray(draft.sales_prospects) ? draft.sales_prospects[0] : draft.sales_prospects;
    if (!prospect || prospect.unsubscribed_at || prospect.replied_at || Number(prospect.followup_count || 0) >= 3) {
      return json(response, 400, { error: "Prospect is not eligible for sending." });
    }

    const result = await sendTransactionalMail({
      to: prospect.email,
      subject: draft.subject_line,
      text: draft.email_body_text,
      html: draft.email_body_html,
      headers: {
        "X-Anutech-Draft-Source": "sales_campaign",
        "X-Anutech-Source-Record-Id": prospect.lead_id
      }
    });
    const sentAt = nowIso();
    await supabase.from("sales_email_drafts").update({
      draft_status: "sent",
      send_result: "sent",
      provider_message_id: result.messageId,
      sent_at: sentAt,
      updated_at: sentAt
    }).eq("id", draft.id);
    await supabase.from("sales_prospects").update({
      prospect_status: draft.sequence_step >= 3 ? "sequence_complete" : "sent",
      sequence_step: draft.sequence_step,
      followup_count: Math.max(Number(prospect.followup_count || 0), draft.sequence_step - 1),
      last_sent_at: sentAt,
      next_followup_at: draft.sequence_step < 3 ? new Date(Date.now() + (draft.sequence_step === 1 ? 4 : 5) * 24 * 60 * 60 * 1000).toISOString() : null,
      updated_at: sentAt
    }).eq("id", prospect.id);
    await logSharedSendEvent({
      draftId: draft.draft_id,
      draftSource: "sales_campaign",
      sourceRecordId: prospect.lead_id,
      email: prospect.email,
      subjectLine: draft.subject_line,
      eventType: "sent",
      providerMessageId: result.messageId,
      detail: `Sent through Sales Tool campaign dashboard via ${result.provider || "smtp"}.`
    });

    return json(response, 200, { ok: true, provider: result.provider || "smtp", messageId: result.messageId });
  }

  if (request.method === "POST" && request.url === "/api/jobs/run") {
    const body = await readBody(request);
    const script = allowedJobs.get(body.job);

    if (!script) {
      return json(response, 400, { error: "Unsupported job." });
    }

    const args = body.job === "review-next-50" ? ["--", "50"] : [];
    const startedAt = nowIso();
    const result = await runNpmScript(script, args);
    await logSharedJobRun({
      jobName: body.job,
      scriptName: script,
      status: result.code === 0 ? "completed" : "failed",
      exitCode: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      startedAt,
      finishedAt: nowIso()
    });
    return json(response, result.code === 0 ? 200 : 500, {
      ok: result.code === 0,
      job: body.job,
      script,
      ...result
    });
  }

  if (request.method === "POST" && request.url === "/api/external-drafts") {
    const body = await readBody(request);
    const drafts = (Array.isArray(body.drafts) ? body.drafts : [body]).map((draft) => ({
      ...draft,
      sourceRecordId: draft.sourceRecordId || randomUUID()
    }));

    const rows = drafts.map(buildDraftRow);
    await appendRows(config.sheetTabs.outreachDrafts, rows);
    await Promise.all(drafts.map((draft) => upsertSharedDraft(buildDraftPayload(draft))));

    return json(response, 200, {
      ok: true,
      count: rows.length,
      source: body.source || drafts[0]?.source || "ai_sdr"
    });
  }

  if (request.method === "POST" && request.url === "/api/send-email") {
    const body = await readBody(request);

    if (!canSendWithResend() && !canSendEmail()) {
      const normalizedBody = {
        ...body,
        sourceRecordId: body.sourceRecordId || randomUUID()
      };
      const row = buildDraftRow({
        ...normalizedBody,
        lead: normalizedBody.to,
        draftStatus: "ready"
      });
      await appendRows(config.sheetTabs.outreachDrafts, [row]);
      const draftPayload = buildDraftPayload({
        ...normalizedBody,
        lead: normalizedBody.to,
        draftStatus: "ready"
      });
      await upsertSharedDraft(draftPayload);
      await logSharedSendEvent({
        draftId: draftPayload.draftId,
        draftSource: draftPayload.draftSource,
        sourceRecordId: draftPayload.sourceRecordId,
        email: draftPayload.email,
        subjectLine: draftPayload.subjectLine,
        eventType: "queued",
        detail: "No email provider configured; queued as source-aware draft."
      });
      return json(response, 202, {
        ok: true,
        sent: false,
        queued: true,
        detail: "No email provider is configured; email queued as draft."
      });
    }

    const recipient = body.to || {};
    const brandedText = brandEmailText(body.text, recipient);
    const brandedHtml = brandEmailHtml({ html: body.html, text: body.text, recipient });
    let result;
    try {
      result = await sendTransactionalMail({
        to: body.to?.email || body.email,
        subject: body.subject,
        text: brandedText,
        html: brandedHtml,
        attachments: Array.isArray(body.attachments)
          ? body.attachments.map((attachment) => ({
              filename: attachment.filename,
              content: Buffer.from(attachment.contentBase64 || "", "base64"),
              contentType: attachment.contentType
            }))
          : undefined,
        headers: {
          "X-Anutech-Draft-Source": body.source || "ai_sdr",
          "X-Anutech-Source-Record-Id": body.sourceRecordId || ""
        }
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "SMTP send failed.";
      await logSharedSendEvent({
        draftSource: body.source || "ai_sdr",
        sourceRecordId: body.sourceRecordId || "",
        email: body.to?.email || body.email,
        subjectLine: body.subject,
        eventType: "failed",
        detail
      });
      return json(response, 500, {
        ok: false,
        sent: false,
        queued: false,
        error: detail,
        emailProvider: emailProviderSummary()
      });
    }
    await logSharedSendEvent({
      draftSource: body.source || "ai_sdr",
      sourceRecordId: body.sourceRecordId || "",
      email: body.to?.email || body.email,
      subjectLine: body.subject,
      eventType: "sent",
      providerMessageId: result.messageId,
      detail: `Sent through My Sales Tool ${result.provider || "smtp"}.`
    });

    return json(response, 200, {
      ok: true,
      sent: true,
      queued: false,
      provider: result.provider || "smtp",
      messageId: result.messageId
    });
  }

  return json(response, 404, { error: "Not found." });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    json(response, 500, {
      error: error instanceof Error ? error.message : "Bridge request failed."
    });
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Client Acquisition bridge listening on http://127.0.0.1:${PORT}`);
});
