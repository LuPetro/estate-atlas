'use client';
import { useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import type { Property } from '@estate-atlas/shared';
import { formatMoney } from '@estate-atlas/shared';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { addBasemap } from './basemap';
import MapModeButton from './MapModeButton';
import type { MapMode } from '@estate-atlas/shared/map';
export default function PropertyMap({
  properties,
  onSelect,
}: {
  properties: Property[];
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fitPortfolio = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const basemap = useRef<ReturnType<typeof addBasemap> | null>(null);
  const modeRef = useRef<MapMode>('simple');
  const [mode, setMode] = useState<MapMode>('simple');
  useEffect(() => {
    setReady(false);
    setFallback(false);
    let dispose = () => {};
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet.markercluster');
      if (cancelled || !ref.current) return;
      const map = L.map(ref.current, { scrollWheelZoom: false, worldCopyJump: true }).setView(
        [35, 10],
        2,
      );
      const background = addBasemap(L, map, () => {
        if (!cancelled) setFallback(true);
      });
      basemap.current = background;
      background.setMode(modeRef.current);
      const cluster = L.markerClusterGroup({
        showCoverageOnHover: false,
        iconCreateFunction: (group) =>
          L.divIcon({
            html: `<span>${group.getChildCount()}</span>`,
            className: 'atlas-cluster',
            iconSize: [44, 44],
          }),
      });
      for (const property of properties) {
        const icon = L.divIcon({
          html: '<span class="map-pin"></span>',
          className: 'atlas-marker',
          iconSize: [32, 40],
          iconAnchor: [16, 38],
          popupAnchor: [0, -34],
        });
        const marker = L.marker([property.latitude, property.longitude], {
          icon,
          title: property.title,
        });
        const popup = document.createElement('button');
        popup.className = 'map-popup';
        const title = document.createElement('strong');
        title.textContent = property.title;
        const value = document.createElement('span');
        value.className = 'map-popup-value';
        value.textContent = formatMoney(property.marketValue, property.currency);
        const action = document.createElement('span');
        action.className = 'map-popup-action';
        action.textContent = 'Details öffnen →';
        popup.append(title, value, action);
        popup.onclick = () => onSelect(property.id);
        marker.bindPopup(popup);
        cluster.addLayer(marker);
      }
      map.addLayer(cluster);
      const fit = () => {
        if (properties.length)
          map.fitBounds(cluster.getBounds(), {
            padding: [55, 55],
            maxZoom: modeRef.current === 'simple' ? 5 : 12,
            animate: false,
          });
        else map.setView([35, 10], 2);
      };
      fitPortfolio.current = fit;
      fit();
      const observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(ref.current);
      dispose = () => {
        fitPortfolio.current = null;
        background.dispose();
        basemap.current = null;
        observer.disconnect();
        map.remove();
      };
      setReady(true);
    })().catch(() => {
      if (ref.current)
        ref.current.textContent = 'Karte konnte nicht geladen werden. Bitte neu laden.';
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [properties, onSelect]);
  return (
    <div className="map-shell">
      <div ref={ref} className="property-map atlas-map" aria-label="Interaktive Immobilienkarte" />
      <div className="map-toolbar">
        <MapModeButton
          mode={mode}
          disabled={!ready}
          onToggle={() => {
            const next = mode === 'simple' ? 'detail' : 'simple';
            modeRef.current = next;
            basemap.current?.setMode(next);
            setMode(next);
            setFallback(false);
          }}
        />
        <button
          type="button"
          className="map-fit-button"
          aria-label="Alle gefilterten Immobilien auf der Karte anzeigen"
          title="Portfolio einpassen"
          disabled={!ready}
          onClick={() => fitPortfolio.current?.()}
        >
          <LocateFixed size={17} aria-hidden="true" />
          <span>Übersicht</span>
        </button>
      </div>
      {fallback && (
        <p role="status" className="map-notice">
          OpenStreetMap als Ersatzkarte geladen.
        </p>
      )}
    </div>
  );
}
