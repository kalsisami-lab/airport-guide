// Schengen Area member states as of 2026-01-01.
// Source: https://en.wikipedia.org/wiki/Schengen_Area
// Verified 2026-06-14:
//   HR joined January 2023 (land borders March 2024)
//   BG + RO joined March 2024 (air borders)
//   Current total: 29 member states
const SCHENGEN_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GR', 'HR', 'HU', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV',
  'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
]);

export function isSchengenCountry(countryCode: string): boolean {
  return SCHENGEN_COUNTRIES.has(countryCode.toUpperCase());
}
