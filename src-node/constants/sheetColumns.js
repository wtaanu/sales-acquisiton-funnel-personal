export const rawLeadColumns = [
  "lead_id",
  "company_name",
  "country",
  "industry",
  "employee_count",
  "funding_stage",
  "recent_signal",
  "hiring_signal",
  "tech_stack",
  "pain_notes",
  "buyer_name",
  "buyer_title",
  "email",
  "website",
  "linkedin_url",
  "source",
  "raw_status",
  "imported_at"
];

export const scoredLeadColumns = [
  "lead_id",
  "company_name",
  "buyer_name",
  "buyer_title",
  "email",
  "country",
  "industry",
  "employee_count",
  "recommended_offer",
  "pitch_angle",
  "roi_reason",
  "lead_score",
  "budget_score",
  "urgency_score",
  "fit_score",
  "buyer_score",
  "qualification_notes",
  "verification_status",
  "verification_sub_status",
  "verification_checked_at",
  "verification_notes",
  "website",
  "scored_at"
];

export const approvedLeadColumns = [
  "lead_id",
  "company_name",
  "buyer_name",
  "buyer_title",
  "email",
  "recommended_offer",
  "lead_score",
  "verification_status",
  "approval_status",
  "owner",
  "send_status",
  "next_action",
  "approved_at"
];

export const outreachDraftColumns = [
  "lead_id",
  "draft_id",
  "draft_type",
  "sequence_step",
  "company_name",
  "buyer_name",
  "buyer_title",
  "email",
  "recommended_offer",
  "parent_send_status",
  "subject_line",
  "email_body_text",
  "email_body_html",
  "loom_angle",
  "cta",
  "signature_name",
  "signature_company",
  "logo_mode",
  "logo_url",
  "draft_source",
  "source_record_id",
  "draft_status",
  "send_result",
  "sent_at",
  "drafted_at"
];

export const inboundReplyColumns = [
  "reply_id",
  "message_id",
  "lead_id",
  "company_name",
  "buyer_name",
  "buyer_title",
  "from_email",
  "subject",
  "received_at",
  "in_reply_to",
  "references",
  "reply_text",
  "reply_category",
  "reply_sentiment",
  "next_action",
  "source_status"
];

export const replyDraftColumns = [
  "reply_id",
  "lead_id",
  "company_name",
  "buyer_name",
  "from_email",
  "original_subject",
  "reply_category",
  "suggested_subject",
  "suggested_reply_text",
  "suggested_reply_html",
  "draft_status",
  "drafted_at"
];

export const companyIntelColumns = [
  "company_id",
  "company_name",
  "website",
  "country",
  "industry",
  "employee_count",
  "funding_stage",
  "buyer_count",
  "lead_count",
  "highest_lead_score",
  "recommended_offer",
  "funnel_stage",
  "saved_list_names",
  "latest_signal",
  "pain_summary",
  "ai_trend_summary",
  "ai_prediction",
  "next_best_action",
  "owner",
  "last_enriched_at"
];

export const savedSearchColumns = [
  "search_id",
  "search_name",
  "query_text",
  "target_geographies",
  "target_industries",
  "target_titles",
  "target_signals",
  "status",
  "last_run_at",
  "last_result_count",
  "notes"
];

export const watchlistColumns = [
  "watchlist_id",
  "list_name",
  "company_id",
  "company_name",
  "website",
  "priority",
  "stage",
  "owner",
  "alert_status",
  "last_signal_at",
  "next_action",
  "notes"
];

export const alertColumns = [
  "alert_id",
  "company_id",
  "company_name",
  "alert_type",
  "alert_title",
  "alert_detail",
  "severity",
  "status",
  "created_at",
  "recommended_action"
];

export const crmSyncColumns = [
  "sync_id",
  "company_id",
  "company_name",
  "lead_id",
  "email",
  "crm_name",
  "crm_record_type",
  "crm_record_id",
  "sync_status",
  "last_synced_at",
  "sync_note"
];

export const enrichmentAddonColumns = [
  "company_id",
  "company_name",
  "primary_domain",
  "primary_persona",
  "likely_team",
  "buying_window_score",
  "urgency_tier",
  "top_signal_keywords",
  "personalized_data_points",
  "enrichment_sources",
  "enrich_status",
  "last_enriched_at"
];

export const crmExportMappingColumns = [
  "crm_name",
  "export_type",
  "source_field",
  "target_field",
  "default_value",
  "status",
  "notes"
];

export const crmExportReadyColumns = [
  "export_id",
  "crm_name",
  "export_type",
  "company_id",
  "company_name",
  "lead_id",
  "contact_name",
  "email",
  "website",
  "target_payload_json",
  "export_status",
  "exported_at",
  "export_note"
];

export const settingsColumns = ["key", "value"];

export const defaultSettingsRows = [
  ["minimum_score", "90"],
  ["target_geographies", "United States,United Kingdom"],
  ["preferred_industries", "B2B SaaS,Law Firm,Real Estate"],
  ["preferred_titles", "Founder,CEO,COO,CTO,Head of Sales,Head of Operations,Managing Partner"],
  ["allowed_verification_statuses", "approved_for_review,manual_review"],
  ["default_signature_name", ""],
  ["default_signature_company", "Anutech Labs"],
  ["logo_mode", "local_preview"],
  ["logo_url", ""],
  ["smtp_from_name", "Anutech Labs"],
  ["smtp_from_email", ""],
  ["send_max_per_run", "5"],
  ["imap_host", ""],
  ["imap_port", "993"],
  ["imap_secure", "true"],
  ["imap_user", ""],
  ["imap_inbox", "INBOX"],
  ["imap_lookback_days", "14"],
  ["company_intel_owner", "Anuragini Pathak"],
  ["default_watchlist_name", "Priority Accounts"],
  ["alert_minimum_score", "60"],
  ["crm_default_name", "personal_crm"],
  ["crm_export_default_type", "account"],
  ["saved_search_default_status", "active"]
];

export const defaultSavedSearchRows = [
  [
    "search-us-saas-ops",
    "US SaaS Ops Buyers",
    "Workflow-heavy SaaS companies with ops, revops, implementation, or customer success signals",
    "United States",
    "B2B SaaS,Software,Enterprise Software",
    "Founder,CEO,COO,Head of Operations,RevOps Manager,Implementation Manager",
    "operations,revops,implementation,onboarding,customer success,workflow",
    "active",
    "",
    "",
    "Primary growth search for SaaS automation buyers"
  ],
  [
    "search-uk-legal-intake",
    "UK Legal Intake Targets",
    "Legal and legal-tech accounts showing intake, document, or approval friction",
    "United Kingdom",
    "Legal,Legal Tech,Professional Services",
    "Managing Partner,COO,Head of Operations,Legal Operations Manager",
    "intake,document,approval,legal operations,workflow",
    "active",
    "",
    "",
    "Use for intake automation and client onboarding offers"
  ],
  [
    "search-staffing-throughput",
    "Staffing Workflow Throughput",
    "Staffing firms and staffing software providers with execution drag or handoff friction",
    "United States,United Kingdom",
    "Staffing,Staffing Software,Consulting",
    "Founder,CEO,COO,Operations Manager",
    "staffing,throughput,handoff,execution drag,workflow",
    "active",
    "",
    "",
    "Use for ops bridge and workflow capacity pitches"
  ],
  [
    "search-priority-accounts",
    "Priority Accounts",
    "High-score accounts ready for closer tracking and CRM sync",
    "United States,United Kingdom",
    "",
    "",
    "priority,buying window,high score",
    "active",
    "",
    "",
    "Catchall search for top scoring accounts"
  ]
];

export const defaultCrmExportMappingRows = [
  ["hubspot", "account", "company_name", "name", "", "active", "Primary company name for HubSpot company records"],
  ["hubspot", "account", "website", "domain", "", "active", "Company website/domain"],
  ["hubspot", "account", "industry", "industry", "", "active", "Industry mapping"],
  ["hubspot", "account", "owner", "hubspot_owner_id", "", "draft", "Map owner when HubSpot owner ids are available"],
  ["hubspot", "contact", "buyer_name", "firstname", "", "active", "Primary contact first/full name"],
  ["hubspot", "contact", "email", "email", "", "active", "Contact email"],
  ["hubspot", "contact", "buyer_title", "jobtitle", "", "active", "Contact role"],
  ["pipedrive", "organization", "company_name", "name", "", "active", "Organization name"],
  ["pipedrive", "organization", "website", "website", "", "active", "Organization website"],
  ["pipedrive", "person", "buyer_name", "name", "", "active", "Person name"],
  ["pipedrive", "person", "email", "email", "", "active", "Person email"],
  ["close", "lead", "company_name", "name", "", "active", "Close lead name"],
  ["close", "lead", "website", "url", "", "active", "Close lead URL"],
  ["close", "contact", "buyer_name", "name", "", "active", "Close contact name"],
  ["close", "contact", "email", "emails", "", "active", "Close contact email"],
  ["personal_crm", "account", "company_name", "company_name", "", "active", "Internal export mapping"],
  ["personal_crm", "account", "website", "website", "", "active", "Internal export mapping"],
  ["personal_crm", "account", "recommended_offer", "recommended_offer", "", "active", "Internal export mapping"],
  ["personal_crm", "contact", "buyer_name", "contact_name", "", "active", "Internal export mapping"],
  ["personal_crm", "contact", "email", "email", "", "active", "Internal export mapping"]
];
