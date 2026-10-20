import type * as Leaflet from 'leaflet';
import { worldCountries, type MapMode } from '@estate-atlas/shared/map';
const osmAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function addBasemap(L: typeof Leaflet, map: Leaflet.Map, onFallback: () => void) {
  const container = map.getContainer();
  const key = process.env.NEXT_PUBLIC_CARTO_MAPS_KEY?.trim();
  let layer: Leaflet.Layer | null = null;
  let mode: MapMode = 'simple';
  let generation = 0;
  const simple = () =>
    L.geoJSON(worldCountries, {
      style: { color: '#fffefa', weight: 1.25, fillColor: '#e0e3d3', fillOpacity: 1 },
      interactive: false,
      attribution: '<a href="https://www.naturalearthdata.com/">Natural Earth</a>',
    });
  const osm = () =>
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: osmAttribution,
      maxZoom: 19,
    });
  const setMode = (next: MapMode) => {
    generation++;
    const current = generation;
    if (layer) map.removeLayer(layer);
    mode = next;
    container.classList.remove('atlas-map-simple', 'atlas-map-osm', 'atlas-map-carto');
    if (next === 'simple') {
      map.setMaxZoom(6);
      container.classList.add('atlas-map-simple');
      layer = simple().addTo(map);
      return;
    }
    map.setMaxZoom(key ? 20 : 19);
    container.classList.add(key ? 'atlas-map-carto' : 'atlas-map-osm');
    if (!key) {
      layer = osm().addTo(map);
      return;
    }
    const tiles = L.tileLayer(
      `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`,
      {
        attribution: `${osmAttribution}, &copy; <a href="https://carto.com/attribution/">CARTO</a>`,
        maxZoom: 20,
      },
    );
    tiles.once('tileerror', () => {
      if (generation !== current || !map.hasLayer(tiles)) return;
      tiles.remove();
      container.classList.replace('atlas-map-carto', 'atlas-map-osm');
      map.setMaxZoom(19);
      layer = osm().addTo(map);
      onFallback();
    });
    layer = tiles.addTo(map);
  };
  setMode('simple');
  return {
    setMode,
    getMode: () => mode,
    dispose: () => {
      generation++;
      if (layer) layer.remove();
    },
  };
}
