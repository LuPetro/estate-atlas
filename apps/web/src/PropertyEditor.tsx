'use client';
import { useState } from 'react';
import { X, Check, MapPin } from 'lucide-react';
import AddressSearch from './AddressSearch';
import LocationMap from './LocationMap';
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
  const [address, setAddress] = useState(property?.address ?? '');
  const [country, setCountry] = useState(property?.country ?? 'AT');
  const [latitude, setLatitude] = useState(property ? String(property.latitude) : '');
  const [longitude, setLongitude] = useState(property ? String(property.longitude) : '');
  const validPosition =
    latitude.trim() &&
    longitude.trim() &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Math.abs(Number(latitude)) <= 90 &&
    Math.abs(Number(longitude)) <= 180;
  const position = validPosition
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null;
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
            <AddressSearch
              value={address}
              onChange={(value) => {
                setAddress(value);
                setLatitude('');
                setLongitude('');
              }}
              onSelect={(result) => {
                setAddress(result.address);
                setCountry(result.country);
                setLatitude(String(result.latitude));
                setLongitude(String(result.longitude));
              }}
            />
            <label>
              Land (ISO-Code)
              <input
                name="country"
                value={country}
                onChange={(event) => setCountry(event.target.value.toUpperCase())}
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
            <div className="full location-picker">
              <div className="location-picker-heading">
                <MapPin size={16} />
                <strong>Position auf der Karte</strong>
              </div>
              <p>
                Adressvorschlag auswählen oder auf die Karte klicken. Ziehe den Pin, um die Position
                genauer zu setzen.
              </p>
              <LocationMap
                position={position}
                onChange={(point) => {
                  setLatitude(point.latitude.toFixed(7));
                  setLongitude(point.longitude.toFixed(7));
                }}
              />
              <p aria-live="polite">
                {position
                  ? 'Position gesetzt. GPS-Felder wurden übernommen.'
                  : 'Noch keine Position gewählt.'}
              </p>
            </div>
            <label>
              Breitengrad
              <input
                name="latitude"
                type="number"
                step="any"
                min={-90}
                max={90}
                required
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
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
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="16.3738"
              />
            </label>
            <p className="form-hint full">
              <MapPin size={14} /> GPS wird aus deiner Auswahl übernommen. Bei Bedarf kannst du die
              Koordinaten auch direkt bearbeiten.
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
