export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}

export async function readCsvFile(file: File): Promise<CsvRow[]> {
  const text = await file.text();
  return parseCsv(text);
}
