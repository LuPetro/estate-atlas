'use client';
import { useState, type ChangeEvent } from 'react';
import { Download, FileUp, X } from 'lucide-react';
import type { ApiClient } from '@estate-atlas/api-client';
import {
  parsePropertyCsv,
  parsePropertyExcel,
  propertyCsvTemplate,
} from '@estate-atlas/shared/csv';
import type { PropertyCsvRow } from '@estate-atlas/shared/csv';

export default function PropertyCsvImport({
  api,
  open,
  onClose,
  onImported,
}: {
  api: ApiClient;
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [rows, setRows] = useState<PropertyCsvRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) return null;
  const close = () => {
    setRows([]);
    setError('');
    onClose();
  };
  const load = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      const isExcel =
        /\.xlsx?$/i.test(file.name) ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.type === 'application/vnd.ms-excel';
      if (file.size > (isExcel ? 5 : 1) * 1024 * 1024)
        throw new Error(
          isExcel
            ? 'Die Excel-Datei darf höchstens 5 MB groß sein.'
            : 'Die CSV-Datei darf höchstens 1 MB groß sein.',
        );
      const parsed = isExcel
        ? parsePropertyExcel(await file.arrayBuffer())
        : parsePropertyCsv(await file.text());
      setRows(parsed.records);
    } catch (e) {
      setRows([]);
      setError((e as Error).message);
    }
  };
  const downloadTemplate = () => {
    const blob = new Blob([propertyCsvTemplate], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'estateatlas-import-vorlage.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  const importRows = async () => {
    const valid = rows.flatMap((row) => (row.input ? [row.input] : []));
    if (!valid.length) return;
    setBusy(true);
    setError('');
    try {
      await api.importProperties(valid);
      setRows([]);
      try {
        await onImported();
        close();
      } catch {
        setError(
          'Der Import war erfolgreich. Die Portfolioansicht konnte nicht aktualisiert werden; lade sie bitte neu.',
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const validCount = rows.filter((row) => row.input).length;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="modal csv-import"
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-import-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">BESTAND ÜBERNEHMEN</p>
            <h2 id="table-import-title">CSV / Excel-Import</h2>
          </div>
          <button className="icon-button" aria-label="Schließen" onClick={close}>
            <X size={20} />
          </button>
        </div>
        <p>
          Importiere bis zu 50 Immobilien auf einmal. Unterstützt werden CSV-Dateien mit Komma oder
          Semikolon sowie Excel-Dateien (.xlsx und .xls). Bei Excel wird das erste Tabellenblatt
          verwendet. Deutsche Spaltennamen werden ebenfalls erkannt.
        </p>
        <p className="csv-privacy">
          Für die Karte müssen Breitengrad und Längengrad in der Datei stehen. Das Land braucht
          einen ISO-2-Code wie AT oder DE. Adressen werden beim Import nicht an einen Geocoder
          gesendet.
        </p>
        <button className="button secondary" onClick={downloadTemplate}>
          <Download size={16} /> Leere CSV-Vorlage laden
        </button>
        <label className="csv-file">
          CSV- oder Excel-Datei auswählen
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={(event) => void load(event)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {!!rows.length && (
          <>
            <p role="status">
              {validCount} von {rows.length} Zeilen sind bereit zum Import.
            </p>
            <div className="csv-preview">
              <table>
                <thead>
                  <tr>
                    <th>Zeile</th>
                    <th>Immobilie</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.line}>
                      <td>{row.line}</td>
                      <td>{row.input?.title ?? '—'}</td>
                      <td>{row.input ? 'Bereit' : row.errors.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.some((row) => !row.input) && (
              <p className="csv-privacy">
                Fehlerhafte Zeilen werden ausgelassen; gültige Zeilen werden gemeinsam importiert.
              </p>
            )}
            <button
              className="button primary"
              disabled={busy || !validCount}
              onClick={() => void importRows()}
            >
              <FileUp size={16} />{' '}
              {busy ? 'Wird importiert …' : `${validCount} Immobilien importieren`}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
