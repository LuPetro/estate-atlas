import type * as Leaflet from 'leaflet';

const osmAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// This is a public, website-restricted tile key, never a server/API credential.
// Without a key, keep the existing OSM provider and apply the local light theme.
export function addBasemap(L: typeof Leaflet, map: Leaflet.Map, onFallback: () => void) {
  const key = process.env.NEXT_PUBLIC_CARTO_MAPS_KEY?.trim();
  const container = map.getContainer();
  const addOsm = () => {
    container.classList.remove('atlas-map-carto');
    container.classList.add('atlas-map-osm');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: osmAttribution,
      maxZoom: 19,
    }).addTo(map);
  };
  if (!key) {
    addOsm();
    return;
  }
  container.classList.add('atlas-map-carto');
  const tiles = L.tileLayer(
    `https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`,
    {
      attribution: `${osmAttribution}, &copy; <a href="https://carto.com/attribution/">CARTO</a>`,
      maxZoom: 20,
    },
  );
  // A missing/expired key or provider outage must not leave a blank map.
  tiles.once('tileerror', () => {
    if (!map.hasLayer(tiles)) return;
    tiles.remove();
    addOsm();
    map.setZoom(Math.min(map.getZoom(), 19));
    onFallback();
  });
  tiles.addTo(map);
}
