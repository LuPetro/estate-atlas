'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function LocationMap({
  position,
  onChange,
}: {
  position: { latitude: number; longitude: number } | null;
  onChange: (position: { latitude: number; longitude: number }) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<Map | null>(null);
  const marker = useRef<Marker | null>(null);
  const latest = useRef({ position, onChange });
  latest.current = { position, onChange };
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let dispose = () => {};
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !container.current) return;
      const initial = latest.current.position;
      const instance = L.map(container.current, {
        scrollWheelZoom: false,
        worldCopyJump: true,
      }).setView(initial ? [initial.latitude, initial.longitude] : [35, 10], initial ? 17 : 2);
      map.current = instance;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(instance);
      const pin = L.marker(initial ? [initial.latitude, initial.longitude] : [0, 0], {
        draggable: true,
        title: 'Immobilienposition',
        icon: L.divIcon({
          html: '<span class="map-pin"></span>',
          className: 'atlas-marker',
          iconSize: [28, 34],
          iconAnchor: [14, 34],
        }),
      });
      marker.current = pin;
      if (initial) pin.addTo(instance);
      const update = (latitude: number, longitude: number) =>
        latest.current.onChange({
          latitude: Math.max(-90, Math.min(90, latitude)),
          longitude: ((((longitude + 180) % 360) + 360) % 360) - 180,
        });
      instance.on('click', (event) => update(event.latlng.lat, event.latlng.lng));
      pin.on('dragend', () => {
        const point = pin.getLatLng();
        update(point.lat, point.lng);
      });
      const observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(container.current);
      dispose = () => {
        observer.disconnect();
        instance.remove();
        map.current = null;
        marker.current = null;
      };
      setReady(true);
    })().catch(() => {
      if (!cancelled)
        setError('Karte konnte nicht geladen werden. GPS kannst du auch manuell eintragen.');
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, []);
  useEffect(() => {
    if (!map.current || !marker.current) return;
    if (!position) {
      marker.current.remove();
      return;
    }
    marker.current.setLatLng([position.latitude, position.longitude]).addTo(map.current);
    map.current.setView(
      [position.latitude, position.longitude],
      Math.max(map.current.getZoom(), 17),
    );
  }, [ready, position?.latitude, position?.longitude]);
  return (
    <>
      <div
        ref={container}
        className="location-map"
        aria-label="Immobilienposition auf der Karte wählen"
      />
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
