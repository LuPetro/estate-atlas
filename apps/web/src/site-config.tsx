import { readFile } from 'node:fs/promises';
type SiteConfig = {
  operator: string;
  address: string;
  supportEmail: string;
  privacyEmail: string;
  hostingProvider: string;
  hostingRegion: string;
  legalNotice: string;
  privacyNotice: string;
  terms: string;
  reviewed: boolean;
};
const blank: SiteConfig = {
  operator: '',
  address: '',
  supportEmail: '',
  privacyEmail: '',
  hostingProvider: '',
  hostingRegion: '',
  legalNotice: '',
  privacyNotice: '',
  terms: '',
  reviewed: false,
};
export async function siteConfig(): Promise<SiteConfig> {
  if (!process.env.SITE_CONFIG_FILE) return blank;
  try {
    const input = JSON.parse(await readFile(process.env.SITE_CONFIG_FILE, 'utf8'));
    const result = { ...blank };
    for (const name of Object.keys(blank) as (keyof SiteConfig)[]) {
      if (name === 'reviewed') result.reviewed = input.reviewed === true;
      else if (typeof input[name] === 'string') result[name] = input[name].trim().slice(0, 50000);
    }
    for (const name of ['supportEmail', 'privacyEmail'] as const)
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result[name])) result[name] = '';
    return result;
  } catch {
    return blank;
  }
}
export function ConfigNotice() {
  return (
    <p className="account-notice">
      Diese private Vorschau ist noch nicht öffentlich freigegeben. Die Betreiberangaben werden vor
      der Veröffentlichung ergänzt.
    </p>
  );
}
