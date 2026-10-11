import { parseCsv, type Table } from './csv';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Wczytuje plik importu (XLSX lub CSV w UTF-8, maks. 5 MB). */
export async function parseImportFile(file: File): Promise<Table> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Plik jest większy niż 5 MB.');
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    const { readXlsx } = await import('./xlsx');
    return readXlsx(await file.arrayBuffer());
  }
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(await file.arrayBuffer());
    return parseCsv(text);
  }
  throw new Error('Obsługiwane formaty: XLSX lub CSV.');
}
