'use client';
import { useState } from 'react';
import { X, Check, MapPin } from 'lucide-react';
import {
  propertyInputSchema,
  propertyTypes,
  propertyTypeLabels,
  currencies,
  conditions,
  conditionLabels,
  type Property,
  type PropertyInput,
} from '@estate-atlas/shared';
export default function PropertyEditor({
  property,
  onSave,
  onClose,
}: {
  property?: Property;
  onSave: (input: PropertyInput) => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const parsed = propertyInputSchema.safeParse({
      title: data.get('title'),
      address: data.get('address'),
      country: data.get('country'),
      latitude: Number(data.get('latitude')),
      longitude: Number(data.get('longitude')),
      type: data.get('type'),
      purchasePrice: Number(data.get('purchasePrice')),
      marketValue: Number(data.get('marketValue')),
      currency: data.get('currency'),
      area: Number(data.get('area')),
      yearBuilt: data.get('yearBuilt') ? Number(data.get('yearBuilt')) : null,
      amenities: String(data.get('amenities') ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      condition: data.get('condition'),
      notes: data.get('notes'),
      isTestData: property?.isTestData ?? false,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      await onSave(parsed.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">DEIN PORTFOLIO</p>
            <h2 id="editor-title">{property ? 'Immobilie bearbeiten' : 'Neue Immobilie'}</h2>
          </div>
          <button aria-label="Schließen" className="icon-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="full">
              Bezeichnung
              <input
                autoFocus
                name="title"
                defaultValue={property?.title}
                required
                minLength={2}
                maxLength={120}
                placeholder="z. B. Stadtwohnung in Wien"
              />
            </label>
            <label className="full">
              Adresse
              <input
                name="address"
                defaultValue={property?.address}
                required
                minLength={3}
                maxLength={300}
                placeholder="Straße, Hausnummer, PLZ und Ort"
              />
            </label>
            <label>
              Land (ISO-Code)
              <input
                name="country"
                defaultValue={property?.country ?? 'AT'}
                required
                minLength={2}
                maxLength={2}
                placeholder="AT"
              />
            </label>
            <label>
              Immobilienart
              <select name="type" defaultValue={property?.type ?? 'apartment'}>
                {propertyTypes.map((t) => (
                  <option key={t} value={t}>
                    {propertyTypeLabels[t]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Breitengrad
              <input
                name="latitude"
                type="number"
                step="any"
                min={-90}
                max={90}
                required
                defaultValue={property?.latitude}
                placeholder="48.2082"
              />
            </label>
            <label>
              Längengrad
              <input
                name="longitude"
                type="number"
                step="any"
                min={-180}
                max={180}
                required
                defaultValue={property?.longitude}
                placeholder="16.3738"
              />
            </label>
            <p className="form-hint full">
              <MapPin size={14} /> GPS manuell eingeben. Deine Adresse wird nicht an einen Geocoder
              übermittelt.
            </p>
            <label>
              Kaufpreis
              <input
                name="purchasePrice"
                type="number"
                min={0}
                max={1e12}
                step="0.01"
                required
                defaultValue={property?.purchasePrice}
              />
            </label>
            <label>
              Marktwert (eigene Schätzung)
              <input
                name="marketValue"
                type="number"
                min={0}
                max={1e12}
                step="0.01"
                required
                defaultValue={property?.marketValue}
              />
            </label>
            <label>
              Währung
              <select name="currency" defaultValue={property?.currency ?? 'EUR'}>
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Fläche (m²)
              <input
                name="area"
                type="number"
                min="0.01"
                max={1e8}
                step="0.01"
                required
                defaultValue={property?.area}
              />
            </label>
            <label>
              Baujahr
              <input
                name="yearBuilt"
                type="number"
                min={1000}
                max={new Date().getFullYear() + 5}
                defaultValue={property?.yearBuilt ?? ''}
              />
            </label>
            <label>
              Zustand
              <select name="condition" defaultValue={property?.condition ?? 'good'}>
                {conditions.map((c) => (
                  <option key={c} value={c}>
                    {conditionLabels[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="full">
              Ausstattung
              <input
                name="amenities"
                maxLength={2000}
                defaultValue={property?.amenities.join(', ')}
                placeholder="Balkon, Aufzug, Garage"
              />
            </label>
            <label className="full">
              Notizen
              <textarea name="notes" maxLength={5000} defaultValue={property?.notes} rows={3} />
            </label>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <footer className="modal-footer">
            <button type="button" className="button secondary" onClick={onClose}>
              Abbrechen
            </button>
            <button className="button primary" disabled={busy}>
              <Check size={16} />
              {busy ? 'Wird gespeichert …' : 'Immobilie speichern'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
