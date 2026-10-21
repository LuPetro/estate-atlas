import { propertyInputSchema, type PropertyInput } from './index';
import * as XLSX from 'xlsx';

export type CsvRecord = { line: number; values: string[]; error?: string };

/** Parses a quoted comma- or semicolon-separated file without guessing at property values. */
export function parseCsvRecords(input: string): { headers: string[]; records: CsvRecord[] } {
  if (input.length > 1024 * 1024) throw new Error('Die CSV-Datei darf höchstens 1 MB groß sein.');
  const source = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const firstLine = source.split('\n', 1)[0] ?? '';
  const count = (delimiter: string) => [...firstLine].filter((char) => char === delimiter).length;
  const delimiter = count(';') > count(',') ? ';' : ',';
  const rows: { values: string[]; line: number; error?: string }[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else {
        cell += char;
        if (char === '\n') line++;
      }
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n') {
      row.push(cell.trim());
      if (row.some((value) => value.length)) rows.push({ values: row, line: rowLine });
      row = [];
      cell = '';
      line++;
      rowLine = line;
    } else cell += char;
  }
  if (quoted) throw new Error('Die CSV-Datei enthält ein nicht geschlossenes Anführungszeichen.');
  row.push(cell.trim());
  if (row.some((value) => value.length)) rows.push({ values: row, line: rowLine });
  if (rows.length < 2)
    throw new Error('Die CSV-Datei braucht eine Kopfzeile und mindestens eine Datenzeile.');
  if (rows.length > 51) throw new Error('Eine CSV-Datei darf höchstens 50 Immobilien enthalten.');
  const headers = rows[0].values.map((value) => value.trim());
  if (headers.some((value) => !value)) throw new Error('Alle Spalten brauchen einen Namen.');
  if (new Set(headers.map((value) => value.toLocaleLowerCase('de'))).size !== headers.length)
    throw new Error('Die CSV-Datei enthält doppelte Spaltennamen.');
  return {
    headers,
    records: rows.slice(1).map(({ values, line }) => ({
      line,
      values: values.slice(0, headers.length),
      ...(values.length !== headers.length
        ? { error: `Erwartet werden ${headers.length} Spalten, gefunden wurden ${values.length}.` }
        : {}),
    })),
  };
}

const headers: Record<string, string> = {
  title: 'title',
  bezeichnung: 'title',
  name: 'title',
  address: 'address',
  adresse: 'address',
  country: 'country',
  land: 'country',
  iso: 'country',
  latitude: 'latitude',
  breitengrad: 'latitude',
  lat: 'latitude',
  longitude: 'longitude',
  laengengrad: 'longitude',
  langengrad: 'longitude',
  lng: 'longitude',
  lon: 'longitude',
  type: 'type',
  art: 'type',
  immobilienart: 'type',
  purchaseprice: 'purchasePrice',
  kaufpreis: 'purchasePrice',
  marketvalue: 'marketValue',
  marktwert: 'marketValue',
  currency: 'currency',
  waehrung: 'currency',
  wahrung: 'currency',
  area: 'area',
  flaeche: 'area',
  flache: 'area',
  qm: 'area',
  yearbuilt: 'yearBuilt',
  baujahr: 'yearBuilt',
  condition: 'condition',
  zustand: 'condition',
  notes: 'notes',
  notizen: 'notes',
  amenities: 'amenities',
  ausstattung: 'amenities',
};

const decimal = (raw: string) => {
  const value = raw.trim().replace(/\s/g, '');
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
  return normalized ? Number(normalized) : Number.NaN;
};
const amount = (raw: string) => {
  const value = raw.trim().replace(/\s/g, '');
  if (value.includes(',')) return Number(value.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d{1,3}(?:\.\d{3})+$/.test(value)) return Number(value.replace(/\./g, ''));
  return value ? Number(value) : Number.NaN;
};

const canonical = (value: string) =>
  value
    .toLocaleLowerCase('de')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
const propertyType = (value: string) => {
  const normalized = canonical(value);
  const known: Record<string, string> = {
    wohnung: 'apartment',
    apartment: 'apartment',
    haus: 'house',
    house: 'house',
    gewerbe: 'commercial',
    commercial: 'commercial',
    grundstuck: 'land',
    land: 'land',
  };
  return known[normalized] ?? value.trim().toLowerCase();
};
const propertyCondition = (value: string) => {
  const normalized = canonical(value);
  const known: Record<string, string> = {
    neuwertig: 'new',
    new: 'new',
    gut: 'good',
    good: 'good',
    sanierungsbedarf: 'renovation',
    renovation: 'renovation',
  };
  return known[normalized] ?? value.trim().toLowerCase();
};

export type PropertyCsvRow = { line: number; input?: PropertyInput; errors: string[] };

export function parsePropertyCsv(input: string) {
  const parsed = parseCsvRecords(input);
  const mappedHeaders = parsed.headers.map((header) => headers[canonical(header)] ?? '');
  const mapped = mappedHeaders.filter(Boolean);
  if (new Set(mapped).size !== mapped.length)
    throw new Error(
      'Mehrere Spalten stehen für dasselbe Immobilienfeld. Bitte nur eine davon verwenden.',
    );
  const required = [
    'title',
    'address',
    'country',
    'type',
    'purchasePrice',
    'marketValue',
    'currency',
    'area',
  ];
  const missing = required.filter((field) => !mappedHeaders.includes(field));
  if (missing.length) throw new Error(`Diese Spalten fehlen: ${missing.join(', ')}.`);
  const records: PropertyCsvRow[] = parsed.records.map(({ line, values, error }) => {
    if (error) return { line, errors: [error] };
    const raw = Object.fromEntries(
      mappedHeaders.flatMap((key, index) => (key ? [[key, values[index] ?? '']] : [])),
    );
    const value = {
      title: raw.title,
      address: raw.address,
      country: raw.country,
      latitude: raw.latitude?.trim() ? decimal(raw.latitude) : Number.NaN,
      longitude: raw.longitude?.trim() ? decimal(raw.longitude) : Number.NaN,
      type: propertyType(raw.type ?? ''),
      purchasePrice: amount(raw.purchasePrice ?? ''),
      marketValue: amount(raw.marketValue ?? ''),
      currency: raw.currency?.trim().toUpperCase(),
      area: amount(raw.area ?? ''),
      yearBuilt: raw.yearBuilt?.trim() ? amount(raw.yearBuilt) : null,
      condition: raw.condition?.trim() ? propertyCondition(raw.condition) : 'good',
      notes: raw.notes ?? '',
      amenities: (raw.amenities ?? '')
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean),
      isTestData: false,
      rental: null,
    };
    const result = propertyInputSchema.safeParse(value);
    return result.success
      ? { line, input: result.data, errors: [] }
      : {
          line,
          errors: result.error.issues.map(
            (issue) => `${String(issue.path[0] ?? 'Zeile')}: ${issue.message}`,
          ),
        };
  });
  return { records, valid: records.filter((row) => row.input).length };
}

export function parsePropertyExcel(input: ArrayBuffer | Uint8Array) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.byteLength > 5 * 1024 * 1024)
    throw new Error('Die Excel-Datei darf höchstens 5 MB groß sein.');
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(bytes, { type: 'array', sheetRows: 52, dense: true });
  } catch {
    throw new Error(
      'Die Excel-Datei kann nicht gelesen werden. Bitte als .xlsx oder .xls speichern.',
    );
  }
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('Die Excel-Datei enthält kein Tabellenblatt.');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: true,
  });
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const cell = value == null ? '' : String(value);
          return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
        })
        .join(','),
    )
    .join('\n');
  return parsePropertyCsv(csv);
}

export const propertyCsvTemplate =
  'title;address;country;latitude;longitude;type;purchasePrice;marketValue;currency;area;yearBuilt;condition;notes;amenities';
