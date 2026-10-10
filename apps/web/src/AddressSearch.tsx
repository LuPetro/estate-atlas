'use client';
import { useEffect, useState } from 'react';
import { ApiClient } from '@estate-atlas/api-client';
import type { GeocodingResult } from '@estate-atlas/shared';

const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');
export default function AddressSearch({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: GeocodingResult) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setResults([]);
    setActive(-1);
    setStatus('');
    setLoading(false);
    if (query.trim().length < 4) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await api.searchAddress(query, controller.signal);
        if (controller.signal.aborted) return;
        setResults(items);
        if (!items.length)
          setStatus('Keine Vorschläge gefunden. Adresse ergänzen oder Pin auf der Karte setzen.');
      } catch (error) {
        if (!controller.signal.aborted) setStatus((error as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 800);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, retry]);
  const select = (result: GeocodingResult) => {
    setQuery('');
    setResults([]);
    setStatus('');
    onSelect(result);
  };
  return (
    <div className="full address-search">
      <label htmlFor="property-address">Adresse</label>
      <input
        id="property-address"
        name="address"
        value={value}
        required
        minLength={3}
        maxLength={300}
        placeholder="Straße, Hausnummer, PLZ und Ort"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={results.length > 0}
        aria-controls="address-suggestions"
        aria-describedby="address-search-hint"
        aria-activedescendant={active >= 0 ? `address-suggestion-${active}` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setQuery('');
            setResults([]);
          }
          if (!results.length) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) =>
              event.key === 'ArrowDown'
                ? (index + 1) % results.length
                : (index <= 0 ? results.length : index) - 1,
            );
          }
          if (event.key === 'Enter' && active >= 0) {
            event.preventDefault();
            select(results[active]);
          }
        }}
      />
      <p id="address-search-hint" className="address-search-hint">
        Vorschläge ab 4 Zeichen. Suchtext wird an Photon gesendet. Daten:{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap
        </a>
        .
      </p>
      <div aria-live="polite" className="address-search-status">
        {loading ? 'Adressen werden gesucht …' : status}
      </div>
      {status && (
        <button
          type="button"
          className="button secondary"
          onClick={() => setRetry((value) => value + 1)}
        >
          Erneut suchen
        </button>
      )}
      <ul
        id="address-suggestions"
        role="listbox"
        aria-label="Adressvorschläge"
        className="address-suggestions"
      >
        {results.map((result, index) => (
          <li key={`${result.address}-${result.latitude}-${result.longitude}`} role="presentation">
            <button
              type="button"
              role="option"
              id={`address-suggestion-${index}`}
              aria-selected={active === index}
              onClick={() => select(result)}
            >
              <strong>{result.label}</strong>
              <small>
                {result.precision === 'building'
                  ? 'Hausadresse'
                  : result.precision === 'street'
                    ? 'Straßenposition – Pin prüfen'
                    : 'Ortsposition – Pin genauer setzen'}
              </small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
