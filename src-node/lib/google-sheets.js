import { google } from "googleapis";
import { config } from "../config.js";

function getAuth() {
  return new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
}

function getSheetsClient() {
  const auth = getAuth();
  return google.sheets({ version: "v4", auth });
}

export async function getSpreadsheetMetadata() {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId: config.googleSheetsId
  });
  return response.data;
}

export async function ensureSheetTabs(sheetNames) {
  const sheets = getSheetsClient();
  const metadata = await getSpreadsheetMetadata();
  const existingSheetNames = new Set(
    (metadata.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean)
  );

  const requests = sheetNames
    .filter((sheetName) => !existingSheetNames.has(sheetName))
    .map((sheetName) => ({
      addSheet: {
        properties: {
          title: sheetName
        }
      }
    }));

  if (!requests.length) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.googleSheetsId,
    requestBody: { requests }
  });
}

export async function appendRows(sheetName, rows) {
  if (!rows.length) {
    return;
  }

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.googleSheetsId,
    range: `${sheetName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: rows
    }
  });
}

export async function readSheet(sheetName) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.googleSheetsId,
    range: `${sheetName}!A:Z`
  });

  const values = response.data.values || [];
  if (!values.length) {
    return [];
  }

  const [header, ...rows] = values;
  return rows.map((row) =>
    Object.fromEntries(header.map((column, index) => [column, row[index] || ""]))
  );
}

export async function readSettingsMap(sheetName) {
  const rows = await readSheet(sheetName);
  return rows.reduce((accumulator, row) => {
    if (row.key) {
      accumulator[row.key] = row.value || "";
    }
    return accumulator;
  }, {});
}

export async function overwriteSheet(sheetName, rows, columns) {
  const sheets = getSheetsClient();
  const values = [
    columns,
    ...rows.map((row) => columns.map((column) => row[column] ?? ""))
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `${sheetName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values }
  });
}

export async function writeHeaderRow(sheetName, columns) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `${sheetName}!A1:Z1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [columns]
    }
  });
}

export async function ensureSettingsRows(sheetName, rows) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.googleSheetsId,
    range: `${sheetName}!A1:B${rows.length + 1}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["key", "value"], ...rows]
    }
  });
}

export async function ensureSeedRows(sheetName, headers, rows) {
  const existingRows = await readSheet(sheetName);
  if (existingRows.length) {
    return;
  }

  await overwriteSheet(
    sheetName,
    rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))),
    headers
  );
}
