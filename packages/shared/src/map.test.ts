import { describe, it, expect } from 'vitest';
import { countryPaths, projectPosition, unprojectPosition, worldCountries } from './map';

describe('shared overview geometry', () => {
  it('projects and recovers property positions across hemispheres', () => {
    for (const [latitude, longitude] of [
      [48.2082, 16.3738],
      [-33.86, 151.2],
      [40.71, -74],
      [0, 0],
      [84, -179],
    ]) {
      const point = projectPosition(latitude, longitude);
      const result = unprojectPosition(point.x, point.y);
      expect(result.latitude).toBeCloseTo(latitude, 8);
      expect(result.longitude).toBeCloseTo(longitude, 8);
    }
  });
  it('clamps polar coordinates and keeps native vector paths finite', () => {
    expect(projectPosition(90, 180)).toEqual(projectPosition(85, 180));
    expect(worldCountries.features).toHaveLength(177);
    expect(new Set(countryPaths.map((country) => country.code)).size).toBe(177);
    for (const country of countryPaths) {
      expect(country.d).toMatch(/^M/);
      expect(country.d).not.toMatch(/NaN|Infinity/);
      expect(country.d).toMatch(/ Z$/);
    }
  });
});
