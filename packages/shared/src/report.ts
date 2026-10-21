import type { Property } from './index';
import { formatMoney, propertyTypeLabels } from './index';
import { rentalSummary } from './rental';

const ascii = (value: string) =>
  value
    .replace(/[ä]/g, 'ae')
    .replace(/[ö]/g, 'oe')
    .replace(/[ü]/g, 'ue')
    .replace(/[Ä]/g, 'Ae')
    .replace(/[Ö]/g, 'Oe')
    .replace(/[Ü]/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/€/g, ' EUR')
    .replace(/²/g, '2')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7e]/g, '');

const pdfString = (value: string) =>
  ascii(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');

function wrap(value: string, width: number) {
  const words = ascii(value).split(/\s+/).filter(Boolean);
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
  const lines = [
    'ESTATEATLAS · IMMOBILIENPORTFOLIO',
    `Erstellt am ${new Intl.DateTimeFormat('de-AT').format(options.createdAt ?? new Date())}`,
    '',
    'Alle Werte stammen aus deinen eigenen Eintraegen und wurden nicht extern bewertet.',
    '',
  ];
  if (!properties.length) lines.push('Keine Immobilien ausgewaehlt.');
  for (const property of properties) {
    lines.push(...wrap(property.title, 78));
    if (property.isTestData)
      lines.push('TESTDATEN - synthetisches Beispiel, keine reale Immobilie');
    lines.push(`${propertyTypeLabels[property.type]} · ${property.country} · ${property.area} m2`);
    lines.push(`Eigener Marktwert: ${formatMoney(property.marketValue, property.currency)}`);
    lines.push(`Kaufpreis: ${formatMoney(property.purchasePrice, property.currency)}`);
    const rental = rentalSummary(property.rental);
    lines.push(`Vermietung: ${rental.label}${rental.period ? ` · ${rental.period}` : ''}`);
    if (options.includeAddresses) lines.push(...wrap(`Adresse: ${property.address}`, 78));
    lines.push('');
  }
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += 42) pages.push(lines.slice(index, index + 42));
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
