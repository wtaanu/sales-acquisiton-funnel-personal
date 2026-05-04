import http from "http";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { config } from "./config.js";
import { outreachDraftColumns, rawLeadColumns } from "./constants/sheetColumns.js";
import { appendRows, readSheet } from "./lib/google-sheets.js";
import { buildLeadId } from "./lib/lead-id.js";
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
import { fetchApolloPeople } from "./services/apollo.js";

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
  const brandedMessage = {
    ...message,
    html: buildBrandedEmailHtml(message.html || textToHtml(message.text || ""), message.subject || "Anutech Labs")
  };
  if (canSendWithResend()) {
    return sendResendMail(brandedMessage);
  }
  return sendMail(brandedMessage);
}

function textToHtml(value = "") {
  return String(value || "")
    .split("\n")
    .map((line) => line ? `<p>${escapeHtml(line)}</p>` : "<br />")
    .join("");
}

function buildBrandedEmailHtml(innerHtml = "", subject = "Anutech Labs") {
  if (/data-anutech-branded=["']true["']/i.test(innerHtml)) {
    return innerHtml;
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://anutechlabs.company";
  const logoUrl = config.logoUrl || process.env.BRAND_LOGO_URL || `${siteUrl}/anutechlabs-logo.png`;
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f6f8;color:#111827;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" data-anutech-branded="true" style="width:640px;max-width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#111827;padding:20px 24px;border-bottom:4px solid #f97316;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left"><img src="${escapeHtml(logoUrl)}" alt="Anutech Labs" style="display:block;max-height:48px;width:auto;"></td>
                  <td align="right" style="color:#fdba74;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;">AI SDR</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 30px;font-size:15px;line-height:1.7;color:#24324a;">
              <div style="font-size:12px;font-weight:700;color:#f97316;text-transform:uppercase;letter-spacing:.12em;margin-bottom:16px;">${escapeHtml(subject)}</div>
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#fff7ed;padding:18px 30px;border-top:1px solid #fed7aa;font-size:13px;line-height:1.6;color:#7c2d12;">
              <strong>Thanks &amp; Regards,<br>AI SDR- Anutech Labs</strong><br>
              Website: <a href="${siteUrl}/" style="color:#ea580c;">${siteUrl}/</a><br>
              <a href="${siteUrl}/unsubscribe" style="color:#ea580c;">Unsubscribe</a> · <a href="${siteUrl}/privacy" style="color:#ea580c;">Privacy policy</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function normalizeSheetRow(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row || {})) {
    const normalizedKey = String(key)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    normalized[normalizedKey] = value;
  }

  const email = String(normalized.email || normalized.email_address || normalized.work_email || "").trim().toLowerCase();
  const leadId = String(normalized.lead_id || normalized.id || "").trim();

  return {
    ...normalized,
    email,
    lead_id: leadId || (email ? `sheet_${email.replace(/[^a-z0-9]+/g, "_")}` : "")
  };
}

function commaList(value, fallback = []) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const items = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
  return items.length ? items : fallback;
}

function apolloFiltersFromBody(body = {}) {
  return {
    page: Number(body.page || config.apollo.page),
    perPage: Number(body.perPage || config.apollo.perPage),
    pagesToPull: Math.max(1, Math.min(Number(body.pagesToPull || body.pages || 1), 10)),
    targetTitles: commaList(body.targetTitles, config.apollo.targetTitles),
    targetLocations: commaList(body.targetLocations, config.apollo.targetLocations),
    emailStatus: commaList(body.emailStatus, config.apollo.emailStatus),
    includeKeywords: commaList(body.includeKeywords || body.keywords, config.apollo.includeKeywords),
    companySize: commaList(body.companySize || body.companySizeRanges),
    excludeKeywords: commaList(body.excludeKeywords || body.exclude),
    revenue: commaList(body.revenue || body.revenueRanges)
  };
}

async function getExistingProspectKeysFromSupabase() {
  const supabase = getSharedSupabaseClient();
  if (!supabase) return { leadIds: new Set(), emails: new Set() };
  const { data } = await supabase.from("sales_prospects").select("lead_id,email").limit(10000);
  return {
    leadIds: new Set((data || []).map((row) => row.lead_id).filter(Boolean)),
    emails: new Set((data || []).map((row) => row.email).filter(Boolean))
  };
}

function mapApolloRowToRawLead(row, timestamp) {
  const email = String(row.email || "").trim().toLowerCase();
  return {
    lead_id: buildLeadId({ company_name: row.company_name, email }),
    company_name: row.company_name || "",
    country: row.country || "",
    industry: row.industry || "",
    employee_count: row.employee_count || "",
    funding_stage: row.funding_stage || "",
    recent_signal: row.recent_signal || "Apollo API prospect",
    hiring_signal: row.hiring_signal || row.buyer_title || "",
    tech_stack: row.tech_stack || "",
    pain_notes: row.pain_notes || "",
    buyer_name: row.buyer_name || "",
    buyer_title: row.buyer_title || "",
    email,
    website: row.website || "",
    linkedin_url: row.linkedin_url || "",
    source: "apollo_api",
    raw_status: "ready_for_scoring",
    imported_at: timestamp
  };
}

async function mirrorSheetProspectsToSupabase() {
  const [rawRows, scoredRows, approvedRows] = await Promise.all([
    readSheet(config.sheetTabs.rawLeads).catch(() => []),
    readSheet(config.sheetTabs.scoredLeads).catch(() => []),
    readSheet(config.sheetTabs.approvedLeads).catch(() => [])
  ]);
  const byLeadId = new Map();

  for (const rawRow of rawRows) {
    const row = normalizeSheetRow(rawRow);
    if (row.lead_id && row.email) byLeadId.set(row.lead_id, { ...row, prospect_status: "new" });
  }
  for (const rawRow of scoredRows) {
    const row = normalizeSheetRow(rawRow);
    if (row.lead_id && row.email) byLeadId.set(row.lead_id, { ...(byLeadId.get(row.lead_id) || {}), ...row, prospect_status: "scored" });
  }
  for (const rawRow of approvedRows) {
    const row = normalizeSheetRow(rawRow);
    if (row.lead_id && row.email) byLeadId.set(row.lead_id, { ...(byLeadId.get(row.lead_id) || {}), ...row, prospect_status: "verified" });
  }

  const rows = Array.from(byLeadId.values()).filter((row) => row.lead_id && row.email);
  const results = await Promise.all(rows.map((row) => upsertSalesProspect(row)));
  return {
    migrated: results.filter(Boolean).length,
    eligible: rows.length,
    sourceRows: {
      raw: rawRows.length,
      scored: scoredRows.length,
      approved: approvedRows.length
    },
    sheetTabs: {
      raw: config.sheetTabs.rawLeads,
      scored: config.sheetTabs.scoredLeads,
      approved: config.sheetTabs.approvedLeads
    }
  };
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
    const prospectSegments = dashboard.prospectSegments || [];
    const customSegments = (dashboard.customSegments || []).map((segment) => ({
        id: segment.segment_id,
        label: segment.label,
        targetCount: segment.target_count,
        apolloKeywords: segment.apollo_keywords,
        titles: segment.target_titles
      }));
    const fallbackSegments = [...customSegments, ...segments];
    const allSegments = prospectSegments.length
      ? [
          ...prospectSegments,
          ...fallbackSegments.filter((segment) => !prospectSegments.some((item) => item.id === segment.id))
        ]
      : fallbackSegments;
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
    const migration = await mirrorSheetProspectsToSupabase();
    return json(response, 200, { ok: true, count: migration.migrated, ...migration });
  }

  if (request.method === "POST" && request.url === "/api/prospects/generate") {
    const body = await readBody(request);
    const filters = apolloFiltersFromBody(body.apolloFilters || body);
    const runResults = [];

    if (body.mode !== "existing") {
      const timestamp = nowIso();
      const existingRawRows = await readSheet(config.sheetTabs.rawLeads).catch(() => []);
      const existingLeadIds = new Set(existingRawRows.map((row) => row.lead_id).filter(Boolean));
      const existingEmails = new Set(existingRawRows.map((row) => String(row.email || row.Email || "").trim().toLowerCase()).filter(Boolean));
      const supabaseKeys = await getExistingProspectKeysFromSupabase();
      for (const leadId of supabaseKeys.leadIds) existingLeadIds.add(leadId);
      for (const email of supabaseKeys.emails) existingEmails.add(email);

      const rawRows = [];
      const pagesPulled = [];
      let apolloReturned = 0;
      let duplicatesSkipped = 0;
      let missingEmailSkipped = 0;
      for (let offset = 0; offset < filters.pagesToPull; offset += 1) {
        const page = filters.page + offset;
        const people = await fetchApolloPeople({ ...filters, page });
        pagesPulled.push(page);
        apolloReturned += people.length;
        for (const person of people) {
          const row = mapApolloRowToRawLead(person, timestamp);
          if (!row.email) {
            missingEmailSkipped += 1;
            continue;
          }
          if (existingLeadIds.has(row.lead_id) || existingEmails.has(row.email)) {
            duplicatesSkipped += 1;
            continue;
          }
          existingLeadIds.add(row.lead_id);
          existingEmails.add(row.email);
          rawRows.push(row);
        }
      }

      if (rawRows.length) {
        await appendRows(config.sheetTabs.rawLeads, rawRows.map((row) => rawLeadColumns.map((column) => row[column] || "")));
        await Promise.all(rawRows.map((row) => upsertSalesProspect({
          ...row,
          prospect_status: "new",
          segment: body.segment || row.segment || undefined,
          lead_score: 0,
          raw_payload: row
        })));
      }
      runResults.push({ job: "apollo-direct-import", code: 0, imported: rawRows.length, apolloReturned, duplicatesSkipped, missingEmailSkipped, pagesPulled, filters });

      for (const job of ["score-leads", "verify-emails"]) {
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
    }

    const migration = await mirrorSheetProspectsToSupabase();
    const importJob = runResults.find((job) => job.job === "apollo-direct-import") || {};
    return json(response, 200, {
      ok: true,
      mode: body.mode || "new",
      apolloFilters: filters,
      pagesPulled: importJob.pagesPulled || [],
      imported: importJob.imported || 0,
      apolloReturned: importJob.apolloReturned || 0,
      duplicatesSkipped: importJob.duplicatesSkipped || 0,
      missingEmailSkipped: importJob.missingEmailSkipped || 0,
      nextPage: filters.page + filters.pagesToPull,
      jobs: runResults,
      migrated: migration.migrated,
      migration
    });
  }

  if (request.method === "POST" && request.url === "/api/prospects/manual") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return json(response, 400, { error: "Email is required." });
    const prospect = await upsertSalesProspect({
      lead_id: body.leadId || buildLeadId({ company_name: body.companyName, email }),
      segment: body.segment || "general_b2b",
      company_name: body.companyName || "",
      buyer_name: body.buyerName || "",
      buyer_title: body.buyerTitle || "",
      email,
      country: body.country || "",
      industry: body.industry || "",
      website: body.website || "",
      source: "manual_admin",
      pain_notes: body.notes || "",
      lead_score: Number(body.leadScore || 0),
      prospect_status: body.prospectStatus || (Number(body.leadScore || 0) > 0 ? "scored" : "new")
    });
    return json(response, prospect ? 200 : 500, prospect ? { ok: true, prospect } : { error: "Unable to create prospect." });
  }

  if (request.method === "POST" && request.url === "/api/prospects/purge-failed") {
    const supabase = getSharedSupabaseClient();
    if (!supabase) return json(response, 500, { error: "Shared Supabase is not configured." });
    const { data: failedEvents, error: failedError } = await supabase
      .from("client_acquisition_email_events")
      .select("email")
      .eq("event_type", "failed");
    if (failedError) return json(response, 500, { error: failedError.message });
    const emails = [...new Set((failedEvents || []).map((row) => row.email).filter(Boolean))];
    if (!emails.length) return json(response, 200, { ok: true, removed: 0 });

    await supabase.from("sales_email_drafts").delete().in("lead_id", (
      await supabase.from("sales_prospects").select("lead_id").in("email", emails)
    ).data?.map((row) => row.lead_id).filter(Boolean) || []);
    const { error: deleteError } = await supabase.from("sales_prospects").delete().in("email", emails);
    if (deleteError) return json(response, 500, { error: deleteError.message });
    return json(response, 200, { ok: true, removed: emails.length, emails });
  }

  if (request.method === "POST" && request.url === "/api/campaigns/generate-drafts") {
    const body = await readBody(request);
    const supabase = getSharedSupabaseClient();
    if (!supabase) return json(response, 500, { error: "Shared Supabase is not configured." });

    const segment = body.segment || "saas_founders";
    const mailType = body.mailType || "intro_value_prop";
    const sourceList = body.sourceList || "existing";
    const limit = Math.min(Number(body.limit || 50), 100);
    const selectedProspectIds = Array.isArray(body.prospectIds) ? body.prospectIds.filter(Boolean) : [];
    const draftInstruction = String(body.draftInstruction || "").trim();

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

    const statusMap = {
      raw: ["new"],
      scored: ["scored"],
      approved: ["verified"],
      sent: ["sent", "sequence_complete"],
      followup: ["sent", "followup_due"],
      existing: ["verified", "scored", "new"]
    };
    let prospectQuery = supabase
      .from("sales_prospects")
      .select("*")
      .is("unsubscribed_at", null)
      .is("replied_at", null)
      .lt("followup_count", 3)
      .order("lead_score", { ascending: false, nullsFirst: false });

    if (selectedProspectIds.length) {
      prospectQuery = prospectQuery.in("id", selectedProspectIds);
    } else {
      prospectQuery = prospectQuery
        .eq("segment", segment)
        .in("prospect_status", statusMap[sourceList] || statusMap.existing)
        .limit(limit);
    }

    const { data: prospects, error: prospectError } = await prospectQuery;
    if (prospectError) return json(response, 500, { error: prospectError.message });

    const drafts = [];
    for (const prospect of prospects || []) {
      const sequenceStep = sourceList === "followup" ? Math.min((prospect.followup_count || 0) + 2, 3) : 1;
      const draft = buildCampaignDraft(prospect, { mailType, sequenceStep, draftInstruction });
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

    const draftIds = Array.isArray(body.draftIds) ? body.draftIds.filter(Boolean) : [];
    if (draftIds.length) {
      const reviewedAt = nowIso();
      const { data, error } = await supabase
        .from("sales_email_drafts")
        .update({
          draft_status: body.status || "reviewed",
          review_notes: body.reviewNotes || "Bulk reviewed from AI SDR admin dashboard.",
          updated_at: reviewedAt
        })
        .in("id", draftIds)
        .select("*");
      return json(response, error ? 500 : 200, error ? { error: error.message } : { ok: true, reviewed: data?.length || 0, drafts: data || [] });
    }

    const { data, error } = await supabase
      .from("sales_email_drafts")
      .update({
        ...(body.subjectLine ? { subject_line: body.subjectLine } : {}),
        ...(body.emailBodyText ? { email_body_text: body.emailBodyText } : {}),
        ...(body.emailBodyHtml ? { email_body_html: body.emailBodyHtml, preview_html: body.previewHtml || body.emailBodyHtml } : {}),
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

    const draftIds = Array.isArray(body.draftIds) ? body.draftIds.filter(Boolean) : [];
    if (draftIds.length) {
      const results = [];
      for (const draftId of draftIds) {
        const { data: draft, error } = await supabase
          .from("sales_email_drafts")
          .select("*, sales_prospects(*)")
          .eq("id", draftId)
          .single();

        if (error || !draft) {
          results.push({ draftId, ok: false, error: error?.message || "Draft not found." });
          continue;
        }
        if (!["reviewed", "ready"].includes(draft.draft_status)) {
          results.push({ draftId, ok: false, error: "Draft is not ready for sending." });
          continue;
        }

        const prospect = Array.isArray(draft.sales_prospects) ? draft.sales_prospects[0] : draft.sales_prospects;
        if (!prospect || prospect.unsubscribed_at || prospect.replied_at || Number(prospect.followup_count || 0) >= 3) {
          results.push({ draftId, ok: false, error: "Prospect is not eligible for sending." });
          continue;
        }

        try {
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
            next_followup_at: draft.sequence_step < 3 ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() : null,
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
          results.push({ draftId, ok: true, provider: result.provider || "smtp", messageId: result.messageId, email: prospect.email });
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Send failed.";
          const failedAt = nowIso();
          await supabase.from("sales_email_drafts").update({
            draft_status: "failed",
            send_result: "failed",
            updated_at: failedAt
          }).eq("id", draft.id);
          await supabase.from("sales_prospects").update({
            prospect_status: "failed",
            verification_notes: detail,
            updated_at: failedAt
          }).eq("id", prospect.id);
          await logSharedSendEvent({
            draftId: draft.draft_id,
            draftSource: "sales_campaign",
            sourceRecordId: prospect.lead_id,
            email: prospect.email,
            subjectLine: draft.subject_line,
            eventType: "failed",
            detail
          });
          results.push({ draftId, ok: false, error: detail, email: prospect.email });
        }
      }

      return json(response, 200, {
        ok: results.some((result) => result.ok),
        sent: results.filter((result) => result.ok).length,
        failed: results.filter((result) => !result.ok).length,
        results
      });
    }

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

    let result;
    try {
      result = await sendTransactionalMail({
        to: prospect.email,
        subject: draft.subject_line,
        text: draft.email_body_text,
        html: draft.email_body_html,
        headers: {
          "X-Anutech-Draft-Source": "sales_campaign",
          "X-Anutech-Source-Record-Id": prospect.lead_id
        }
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Send failed.";
      const failedAt = nowIso();
      await supabase.from("sales_email_drafts").update({
        draft_status: "failed",
        send_result: "failed",
        updated_at: failedAt
      }).eq("id", draft.id);
      await supabase.from("sales_prospects").update({
        prospect_status: "failed",
        verification_notes: detail,
        updated_at: failedAt
      }).eq("id", prospect.id);
      await logSharedSendEvent({
        draftId: draft.draft_id,
        draftSource: "sales_campaign",
        sourceRecordId: prospect.lead_id,
        email: prospect.email,
        subjectLine: draft.subject_line,
        eventType: "failed",
        detail
      });
      return json(response, 500, { ok: false, sent: false, failed: 1, error: detail, email: prospect.email });
    }
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
      next_followup_at: draft.sequence_step < 3 ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() : null,
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
