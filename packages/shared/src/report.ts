import type { Property } from './index';
import { propertyTypeLabels } from './index';
import { rentalSummary } from './rental';

const printable = (value: string) =>
  value
    .normalize('NFC')
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/€/g, 'EUR')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\xff]/gu, '?');

const pdfString = (value: string) =>
  printable(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replace(
      /[\x80-\xff]/g,
      (character) => `\\${character.charCodeAt(0).toString(8).padStart(3, '0')}`,
    );

const money = (value: number, currency: Property['currency']) =>
  new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(value);

function wrap(value: string, width: number) {
  const words = printable(value)
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => word.match(new RegExp(`.{1,${width}}`, 'gu')) ?? []);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** Builds a simple local PDF report. Addresses are excluded unless the user opts in. */
export function portfolioReportPdf(
  properties: Property[],
  options: { includeAddresses?: boolean; createdAt?: Date } = {},
) {
  const blocks: string[][] = [
    [
      'ESTATEATLAS · IMMOBILIENPORTFOLIO',
      `Erstellt am ${new Intl.DateTimeFormat('de-AT').format(options.createdAt ?? new Date())}`,
      '',
      'Marktwerte und Kaufpreise nach eigenen Angaben.',
      '',
    ],
  ];
  if (!properties.length) blocks.push(['Keine Immobilien ausgewählt.']);
  for (const property of properties) {
    const lines: string[] = [];
    lines.push(...wrap(property.title, 78));
    if (property.isTestData)
      lines.push('TESTDATEN - synthetisches Beispiel, keine reale Immobilie');
    lines.push(
      `${propertyTypeLabels[property.type]} · ${property.country} · ${property.area} m²${property.archivedAt ? ' · Archiviert' : ''}`,
    );
    lines.push(`Eigener Marktwert: ${money(property.marketValue, property.currency)}`);
    lines.push(`Kaufpreis: ${money(property.purchasePrice, property.currency)}`);
    const rental = rentalSummary(property.rental);
    lines.push(`Vermietung: ${rental.label}${rental.period ? ` · ${rental.period}` : ''}`);
    if (options.includeAddresses) lines.push(...wrap(`Adresse: ${property.address}`, 78));
    lines.push('');
    blocks.push(lines);
  }
  const currencies = [...new Set(properties.map((property) => property.currency))];
  if (properties.length)
    blocks.push([
      'Summen der Auswahl nach Währung',
      ...currencies.flatMap((currency) => {
        const group = properties.filter((property) => property.currency === currency);
        return [
          `${currency} · ${group.length} ${group.length === 1 ? 'Immobilie' : 'Immobilien'}`,
          `Marktwert: ${money(
            group.reduce((sum, property) => sum + property.marketValue, 0),
            currency,
          )}`,
          `Kaufpreis: ${money(
            group.reduce((sum, property) => sum + property.purchasePrice, 0),
            currency,
          )}`,
        ];
      }),
    ]);
  const pages: string[][] = [];
  let page: string[] = [];
  for (const block of blocks) {
    if (page.length && page.length + block.length > 42) {
      pages.push(page);
      page = [];
    }
    page.push(...block);
  }
  if (page.length) pages.push(page);
  const objects: string[] = [''];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  pages.forEach((pageLines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const commands = ['BT', '/F1 10 Tf', '50 792 Td', '14 TL'];
    pageLines.forEach((line, lineIndex) => {
      if (lineIndex === 0 && index === 0) commands.push('/F1 16 Tf');
      else if (lineIndex === 1 && index === 0) commands.push('/F1 10 Tf');
      commands.push(`(${pdfString(line)}) Tj`, 'T*');
    });
    commands.push('ET');
    commands.push(
      'BT',
      '/F1 8 Tf',
      '50 35 Td',
      `(${pdfString(`EstateAtlas · ${index + 1} / ${pages.length}`)}) Tj`,
      'ET',
    );
    const stream = commands.join('\n');
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });
  let document = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id++) {
    offsets.push(document.length);
    document += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = document.length;
  document += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    document += `${String(offset).padStart(10, '0')} 00000 n \n`;
  document += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Uint8Array.from(Array.from(document, (character) => character.charCodeAt(0)));
}
