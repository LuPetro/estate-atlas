'use client';
import { useEffect, useRef } from 'react';
import type { Property } from '@estate-atlas/shared';
import { formatMoney } from '@estate-atlas/shared';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
export default function PropertyMap({
  properties,
  onSelect,
}: {
  properties: Property[];
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
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
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      const cluster = L.markerClusterGroup({ showCoverageOnHover: false });
      for (const property of properties) {
        const icon = L.divIcon({
          html: '<span class="map-pin"></span>',
          className: 'atlas-marker',
          iconSize: [28, 34],
          iconAnchor: [14, 34],
        });
        const marker = L.marker([property.latitude, property.longitude], {
          icon,
          title: property.title,
        });
        const popup = document.createElement('button');
        popup.className = 'map-popup';
        popup.textContent = `${property.title} · ${formatMoney(property.marketValue, property.currency)}`;
        popup.onclick = () => onSelect(property.id);
        marker.bindPopup(popup);
        cluster.addLayer(marker);
      }
      map.addLayer(cluster);
      if (properties.length) map.fitBounds(cluster.getBounds(), { padding: [45, 45], maxZoom: 12 });
      const observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(ref.current);
      dispose = () => {
        observer.disconnect();
        map.remove();
      };
    })().catch(() => {
      if (ref.current)
        ref.current.textContent = 'Karte konnte nicht geladen werden. Bitte neu laden.';
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [properties, onSelect]);
  return <div ref={ref} className="property-map" aria-label="Interaktive Immobilienkarte" />;
}
