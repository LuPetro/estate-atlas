'use client';
import { useEffect, useState } from 'react';
import { FileText, Upload, Trash2, Download, ExternalLink, Search, FolderOpen } from 'lucide-react';
import { ApiClient } from '@estate-atlas/api-client';
import type { Asset, Property } from '@estate-atlas/shared';

export function DocumentList({
  assets,
  properties,
  api,
  onDelete,
  busy,
  onSelect,
  onError,
}: {
  assets: Asset[];
  properties: Property[];
  api: ApiClient;
  onDelete: (id: string) => Promise<void>;
  busy: boolean;
  onSelect?: (id: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="document-list">
      {assets.map((asset) => {
        const property = properties.find((p) => p.id === asset.propertyId);
        const canEdit = property && property.access !== 'viewer';
        return (
          <article className="document-row" key={asset.id}>
            <div
              className={`document-preview ${asset.mimeType === 'application/pdf' ? 'pdf' : ''}`}
            >
              {asset.mimeType.startsWith('image/') ? (
                <img src={api.assetUrl(asset.id)} alt="" loading="lazy" />
              ) : (
                <FileText size={23} />
              )}
            </div>
            <div className="document-name">
              <a href={api.assetUrl(asset.id)} target="_blank" rel="noreferrer">
                {asset.name}
              </a>
              <small>
                {asset.mimeType === 'application/pdf' ? 'PDF' : 'Bild'} ·{' '}
                {(asset.size / 1024).toLocaleString('de-AT', { maximumFractionDigits: 0 })} KB ·{' '}
                {new Date(asset.createdAt).toLocaleDateString('de-AT')}
              </small>
              {onSelect && property && (
                <button className="text-button" onClick={() => onSelect(property.id)}>
                  {property.title}
                </button>
              )}
            </div>
            <div className="document-actions">
              <a
                className="icon-button"
                href={api.assetUrl(asset.id)}
                target="_blank"
                rel="noreferrer"
                aria-label={`${asset.name} öffnen`}
              >
                <ExternalLink size={16} />
              </a>
              <a
                className="icon-button"
                aria-label={`${asset.name} herunterladen`}
                href={api.assetUrl(asset.id, true)}
              >
                <Download size={16} />
              </a>
              {canEdit && (
                <button
                  className="icon-button"
                  aria-label={`${asset.name} löschen`}
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Anhang endgültig löschen?')) void onDelete(asset.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function UploadDocument({
  propertyId,
  api,
  onUploaded,
  onError,
  disabled = false,
}: {
  propertyId: string;
  api: ApiClient;
  onUploaded: () => Promise<void>;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label className={`button secondary upload-button ${disabled ? 'disabled' : ''}`}>
      <Upload size={16} />
      {busy ? 'Wird gespeichert …' : 'Datei hinzufügen'}
      <input
        type="file"
        aria-label="Datei hinzufügen"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        disabled={busy || disabled}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) {
            onError('Die Datei darf höchstens 10 MB groß sein.');
            return;
          }
          setBusy(true);
          onError('');
          try {
            await api.upload(propertyId, file);
            await onUploaded();
          } catch (error) {
            onError((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}

export default function Documents({
  properties,
  api,
  onSelect,
  revision,
}: {
  properties: Property[];
  api: ApiClient;
  onSelect: (id: string) => void;
  revision: string;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [kind, setKind] = useState('');
  const [uploadProperty, setUploadProperty] = useState('');
  const load = async () => {
    setLoading(true);
    try {
      setAssets(await api.assets());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [revision]);
  const options = properties.filter((p) => !p.archivedAt && p.access !== 'viewer');
  const selectedUpload = options.some((p) => p.id === uploadProperty)
    ? uploadProperty
    : (options[0]?.id ?? '');
  const shown = assets.filter(
    (a) =>
      properties.some((p) => p.id === a.propertyId) &&
      (!propertyId || a.propertyId === propertyId) &&
      (!kind ||
        (kind === 'pdf' ? a.mimeType === 'application/pdf' : a.mimeType.startsWith('image/'))) &&
      a.name.toLocaleLowerCase('de').includes(query.trim().toLocaleLowerCase('de')),
  );
  return (
    <section aria-label="Dokumentenablage" className="documents-page">
      <div className="document-intro panel">
        <div className="document-intro-icon">
          <FolderOpen size={30} />
        </div>
        <div>
          <h2>Alles zum Objekt. An einem Ort.</h2>
          <p>Exposés, Verträge, Protokolle und Fotos kannst du hier optional speichern.</p>
          <small>
            JPEG, PNG, WebP oder PDF · maximal 10 MB je Datei · Zugriff gemäß Objektfreigabe
          </small>
        </div>
        {options.length > 0 && (
          <div className="document-upload">
            <label>
              Speichern bei
              <select
                aria-label="Upload-Immobilie"
                value={selectedUpload}
                onChange={(e) => setUploadProperty(e.target.value)}
              >
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <UploadDocument
              propertyId={selectedUpload}
              api={api}
              onUploaded={load}
              onError={setError}
            />
          </div>
        )}
      </div>
      <div className="portfolio-toolbar">
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Dokumente suchen"
            placeholder="Dateiname suchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Dokumente nach Immobilie"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        >
          <option value="">Alle zugänglichen Immobilien</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
              {p.access && p.access !== 'owner' ? ' · geteilt' : ''}
            </option>
          ))}
        </select>
        <select aria-label="Dokumenttyp" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Alle Dateitypen</option>
          <option value="pdf">Dokumente (PDF)</option>
          <option value="image">Fotos</option>
        </select>
        <span className="muted">{shown.length} Dateien</span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() => {
              setError('');
              void load();
            }}
          >
            Erneut laden
          </button>
        </p>
      )}
      {loading ? (
        <p role="status">Dokumente werden geladen …</p>
      ) : shown.length ? (
        <DocumentList
          assets={shown}
          properties={properties}
          api={api}
          busy={busy}
          onSelect={onSelect}
          onError={setError}
          onDelete={async (id) => {
            setBusy(true);
            setError('');
            try {
              await api.deleteAsset(id);
              await load();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : (
        <div className="workspace-empty">
          <FileText size={32} />
          <h3>{assets.length ? 'Keine passenden Dateien' : 'Deine Ablage ist bereit'}</h3>
          <p>
            {assets.length
              ? 'Passe die Suche oder die Filter an.'
              : 'Wähle eine Immobilie und füge bei Bedarf die erste Datei hinzu.'}
          </p>
        </div>
      )}
    </section>
  );
}
