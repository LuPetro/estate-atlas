import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { sampleProperties, type Property } from './index';
import { parsePropertyCsv, parsePropertyExcel, propertyCsvTemplate } from './csv';
import { localDateKey } from './reminders';
import { portfolioReportPdf } from './report';

const header =
  'Bezeichnung;Adresse;Land;Breitengrad;Längengrad;Immobilienart;Kaufpreis;Marktwert;Währung;Fläche';
const row =
  'TESTDATEN Wohnung;Beispielstraße 1;AT;48,2;16,3;Wohnung;250.000,50;280.000,75;EUR;75,5';

describe('portfolio table import', () => {
  it('reads German headings, quoted cells, decimal commas and row errors before any upload', () => {
    const result = parsePropertyCsv(
      `${header}\n${row}\n"TESTDATEN; zweite Wohnung";Beispielstraße 2;AT;48,2;16,3;Haus;0;100;EUR;50\nDefekt;Adresse;AT;999;16,3;Wohnung;0;100;EUR;50`,
    );
    expect(result.valid).toBe(2);
    expect(result.records[0].input).toMatchObject({
      title: 'TESTDATEN Wohnung',
      latitude: 48.2,
      purchasePrice: 250000.5,
      marketValue: 280000.75,
      area: 75.5,
    });
    expect(result.records[1].input?.title).toBe('TESTDATEN; zweite Wohnung');
    expect(result.records[2]).toMatchObject({
      line: 4,
      errors: [expect.stringContaining('Breitengrad')],
    });
  });

  it('requires map coordinates, rejects duplicate mapped columns and enforces the row limit', () => {
    expect(() => parsePropertyCsv(`${header.replace(';Breitengrad', '')}\n${row}`)).toThrow(
      'Breitengrad',
    );
    expect(() => parsePropertyCsv(`${header};title\n${row};Doppelt`)).toThrow(
      'dasselbe Immobilienfeld',
    );
    expect(() => parsePropertyCsv(`${header}\n${Array(51).fill(row).join('\n')}`)).toThrow(
      '50 Immobilien',
    );
    expect(propertyCsvTemplate).toContain('latitude;longitude');
  });

  it('reads real XLSX and XLS files and rejects oversized workbooks instead of silently truncating', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      header.split(';'),
      ['TESTDATEN Excel', 'Beispielstraße 1', 'AT', 48.2, 16.3, 'Wohnung', 1000.5, 2000, 'EUR', 75],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Bestand');
    for (const bookType of ['xlsx', 'xls'] as const) {
      const bytes = XLSX.write(book, { type: 'array', bookType });
      expect((await parsePropertyExcel(bytes)).records[0].input).toMatchObject({
        title: 'TESTDATEN Excel',
        purchasePrice: 1000.5,
        latitude: 48.2,
      });
    }
    XLSX.utils.sheet_add_aoa(
      sheet,
      Array.from({ length: 51 }, () => row.split(';')),
      { origin: 'A2' },
    );
    await expect(
      parsePropertyExcel(XLSX.write(book, { type: 'array', bookType: 'xlsx' })),
    ).rejects.toThrow('50 Immobilien');
  });
});

describe('local portfolio exports and dates', () => {
  const properties = sampleProperties
    .slice(0, 2)
    .map((property, i) => ({
      ...property,
      id: String(i),
      ownerId: 'fixture',
      access: 'owner',
      archivedAt: null,
      createdAt: '',
      updatedAt: '',
      address: 'PRIVATE ADDRESS',
      currency: i ? 'USD' : 'EUR',
    })) as Property[];

  it('creates a PDF with separate currencies and includes addresses only when selected', () => {
    const pdf = new TextDecoder().decode(portfolioReportPdf(properties));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('EUR');
    expect(pdf).toContain('USD');
    expect(pdf).toContain('TESTDATEN');
    expect(pdf).not.toContain('PRIVATE ADDRESS');
    expect(
      new TextDecoder().decode(portfolioReportPdf(properties, { includeAddresses: true })),
    ).toContain('PRIVATE ADDRESS');
  });

  it('uses the device calendar day near a UTC date boundary', () => {
    const previous = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Honolulu';
      expect(localDateKey(new Date('2026-10-21T00:30:00Z'))).toBe('2026-10-20');
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });
});
