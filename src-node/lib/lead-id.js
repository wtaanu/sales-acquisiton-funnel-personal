export function buildLeadId(row) {
  const emailPart = (row.email || "no-email").toLowerCase().replace(/[^a-z0-9]/g, "-");
  const companyPart = (row.company_name || "company").toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `${companyPart}-${emailPart}`;
}
