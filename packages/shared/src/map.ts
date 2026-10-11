import data from './world-countries.json';
export type MapMode = 'simple' | 'detail';
type Position = [number, number];
type Geometry =
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };
export const worldCountries = data as {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: { name: string; code: string }; geometry: Geometry }[];
};
export function projectPosition(latitude: number, longitude: number) {
  const lat = (Math.max(-85, Math.min(85, latitude)) * Math.PI) / 180;
  return {
    x: (longitude + 180) / 360,
    y: (1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2,
  };
}
export function unprojectPosition(x: number, y: number) {
  return {
    latitude: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
    longitude: x * 360 - 180,
  };
}
export const countryPaths = worldCountries.features.map((feature) => {
  const polygons =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
  const d = polygons
    .map((polygon) =>
      polygon
        .map(
          (ring) =>
            ring
              .map(([lon, lat], index) => {
                const p = projectPosition(lat, lon);
                return `${index ? 'L' : 'M'}${(p.x * 1000).toFixed(2)},${(p.y * 1000).toFixed(2)}`;
              })
              .join(' ') + ' Z',
        )
        .join(' '),
    )
    .join(' ');
  return { ...feature.properties, d };
});
