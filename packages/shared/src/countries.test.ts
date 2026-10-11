import { it, expect } from 'vitest';
import { countryCodeSchema, countryCodes, countryFromEvidence } from './countries';
import { propertyInputSchema, sampleProperties } from './index';
it('accepts registered country codes and rejects invented ones in property data', () => {
  expect(countryCodes).toHaveLength(249);
  for (const code of ['AT', 'DE', 'US', 'AU', 'AE', 'JP'])
    expect(countryCodeSchema.safeParse(code).success).toBe(true);
  for (const country of ['OZ', 'XX', 'ZZ'])
    expect(propertyInputSchema.safeParse({ ...sampleProperties[0], country }).success).toBe(false);
});
it('normalizes explicit country evidence without guessing from domains or city names', () => {
  expect(countryFromEvidence('Wohnung; 1200 Wien, Österreich')).toBe('AT');
  expect(countryFromEvidence('Country: AT')).toBe('AT');
  expect(countryFromEvidence('Country: Austria')).toBe('AT');
  expect(countryFromEvidence('Deutschland')).toBe('DE');
  expect(countryFromEvidence('Australia')).toBe('AU');
  expect(countryFromEvidence('South Sudan')).toBe('SS');
  expect(countryFromEvidence('Equatorial Guinea')).toBe('GQ');
  expect(countryFromEvidence('Guinea-Bissau')).toBe('GW');
  for (const text of [
    'Country: OZ',
    'Wien',
    'www.example.at',
    'Austria and Germany',
    'Country: DE Austria',
  ])
    expect(countryFromEvidence(text)).toBeNull();
});
