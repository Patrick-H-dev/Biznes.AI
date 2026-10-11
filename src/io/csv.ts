// Prosty parser CSV (RFC 4180): cudzysłowy, podwójny cudzysłów jako escape,
// separator `,` lub `;` wykrywany automatycznie z wiersza nagłówka.

export interface Table {
  headers: string[];
  /** Wiersze danych; numer wiersza w pliku = indeks + 2 (wiersz 1 to nagłówek) */
  rows: string[][];
}

export function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  let commas = 0;
  let semis = 0;
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ',') commas++;
    else if (!quoted && ch === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}

export function parseCsv(input: string, delimiter?: ',' | ';'): Table {
  const text = input.replace(/^﻿/, '');
  const sep = delimiter ?? detectDelimiter(text);
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === sep) {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const [headers = [], ...rows] = records;
  return { headers: headers.map((h) => h.trim()), rows };
}

function escapeField(value: string, sep: string): string {
  return /["\r\n]/.test(value) || value.includes(sep) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: string[], rows: string[][], sep: ',' | ';' = ','): string {
  return [headers, ...rows].map((r) => r.map((v) => escapeField(v, sep)).join(sep)).join('\r\n') + '\r\n';
}
