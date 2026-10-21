'use client';
import { useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import type { Property } from '@estate-atlas/shared';
import { portfolioReportPdf } from '@estate-atlas/shared/report';

export default function PortfolioReportDialog({
  properties,
  onClose,
}: {
  properties: Property[];
  onClose: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState(() =>
    properties.filter((property) => !property.archivedAt).map((property) => property.id),
  );
  const [includeAddresses, setIncludeAddresses] = useState(false);
  const toggle = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((selected) => selected !== id) : [...current, id],
    );
  const selected = properties.filter((property) => selectedIds.includes(property.id));
  const download = () => {
    const data = portfolioReportPdf(selected, { includeAddresses });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `estateatlas-portfolio-${new Date().toISOString().slice(0, 10)}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onClose();
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">PORTFOLIO TEILEN</p>
            <h2 id="report-title">PDF-Bericht erstellen</h2>
          </div>
          <button className="icon-button" aria-label="Schließen" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="report-content">
          <p>
            Wähle die Immobilien für deinen Bericht. Die PDF-Datei wird direkt in diesem Browser
            erstellt und an keinen externen Dienst gesendet.
          </p>
          <div className="report-list" aria-label="Immobilien auswählen">
            {properties.map((property) => (
              <label className="report-property" key={property.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(property.id)}
                  onChange={() => toggle(property.id)}
                />
                <span>
                  <strong>{property.title}</strong>
                  <small>
                    {property.archivedAt ? 'Archiviert' : 'Aktiv'} · {property.country}
                  </small>
                </span>
              </label>
            ))}
            {!properties.length && <p>Lege zuerst eine Immobilie an.</p>}
          </div>
          <label className="inline-check report-address-check">
            <input
              type="checkbox"
              checked={includeAddresses}
              onChange={(event) => setIncludeAddresses(event.target.checked)}
            />
            Adressen in den Bericht aufnehmen
          </label>
          <p className="report-privacy">
            Marktwerte und Kaufpreise sind deine eigenen Angaben. Währungen werden nicht umgerechnet
            oder zu einer Gesamtsumme addiert.
          </p>
          <div className="report-actions">
            <button className="button secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button className="button primary" disabled={!selected.length} onClick={download}>
              {selected.length ? <Download size={16} /> : <FileText size={16} />}
              {selected.length
                ? `${selected.length} ${selected.length === 1 ? 'Immobilie' : 'Immobilien'} als PDF`
                : 'Immobilien auswählen'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
