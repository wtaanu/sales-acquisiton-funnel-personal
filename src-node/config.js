import dotenv from "dotenv";

dotenv.config();

export const config = {
  googleSheetsId: process.env.GOOGLE_SHEETS_ID || "",
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
  googlePrivateKey: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  zeroBounceApiKey: process.env.ZEROBOUNCE_API_KEY || "",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  minimumScore: Number(process.env.MINIMUM_SCORE || 90),
  defaultSignatureName: process.env.DEFAULT_SIGNATURE_NAME || "Anuragini Pathak",
  defaultSignatureCompany: process.env.DEFAULT_SIGNATURE_COMPANY || "Anutech Labs",
  logoMode: process.env.LOGO_MODE || "local_preview",
  logoUrl: process.env.LOGO_URL || "",
  apolloImportFile: process.env.APOLLO_IMPORT_FILE || "./data/sample_leads.csv",
  apollo: {
    importMode: process.env.APOLLO_IMPORT_MODE || "csv",
    apiKey: process.env.APOLLO_API_KEY || "",
    page: Number(process.env.APOLLO_PAGE || 1),
    perPage: Number(process.env.APOLLO_PER_PAGE || 25),
    targetTitles: (process.env.APOLLO_TARGET_TITLES || "founder,owner,c_suite,head,director,manager")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    targetLocations: (process.env.APOLLO_TARGET_LOCATIONS || "United States,United Kingdom")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    emailStatus: (process.env.APOLLO_EMAIL_STATUS || "verified,likely to engage")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    includeKeywords: (process.env.APOLLO_INCLUDE_KEYWORDS || "operations,revops,sales ops,customer success")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    fromEmail: process.env.SMTP_FROM_EMAIL || "",
    fromName: process.env.SMTP_FROM_NAME || "Anutech Labs",
    replyTo: process.env.SMTP_REPLY_TO || "",
    enableReadReceipts:
      String(process.env.SMTP_ENABLE_READ_RECEIPTS || "true").toLowerCase() === "true",
    readReceiptTo: process.env.SMTP_READ_RECEIPT_TO || "",
    tlsRejectUnauthorized:
      String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true").toLowerCase() === "true",
    maxPerRun: Number(process.env.SEND_MAX_PER_RUN || 5)
  },
  imap: {
    host: process.env.IMAP_HOST || process.env.SMTP_HOST || "",
    port: Number(process.env.IMAP_PORT || 993),
    secure: String(process.env.IMAP_SECURE || "true").toLowerCase() === "true",
    user: process.env.IMAP_USER || process.env.SMTP_USER || "",
    pass: process.env.IMAP_PASS || process.env.SMTP_PASS || "",
    inbox: process.env.IMAP_INBOX || "INBOX",
    tlsRejectUnauthorized:
      String(process.env.IMAP_TLS_REJECT_UNAUTHORIZED || process.env.SMTP_TLS_REJECT_UNAUTHORIZED || "true").toLowerCase() === "true",
    lookbackDays: Number(process.env.IMAP_LOOKBACK_DAYS || 14)
  },
  sheetTabs: {
    rawLeads: "Raw Leads",
    scoredLeads: "Scored Leads",
    approvedLeads: "Approved Leads",
    outreachDrafts: "Outreach Drafts",
    inboundReplies: "Inbound Replies",
    replyDrafts: "Reply Drafts",
    companyIntel: "Company Intelligence",
    enrichmentAddons: "Enrichment Add-ons",
    savedSearches: "Saved Searches",
    watchlists: "Watchlists",
    alerts: "Alerts",
    crmSync: "CRM Sync",
    crmExportMappings: "CRM Export Mappings",
    crmExportReady: "CRM Export Ready",
    settings: "Settings"
  }
};
