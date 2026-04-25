import fs from "node:fs";
import { parse } from "csv-parse/sync";

export function readCsvRows(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true
  });
}
