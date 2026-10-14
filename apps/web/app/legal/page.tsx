import InfoPage from '../../src/InfoPage';
import { siteConfig, ConfigNotice } from '../../src/site-config';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const c = await siteConfig();
  return (
    <InfoPage title="Impressum">
      {!c.reviewed && <ConfigNotice />}
      {c.operator && (
        <section>
          <h2>Betreiber</h2>
          <p className="legal-text">
            {c.operator}
            {'\n'}
            {c.address}
          </p>
        </section>
      )}
      {c.supportEmail && (
        <p>
          <a href={`mailto:${c.supportEmail}`}>{c.supportEmail}</a>
        </p>
      )}
      {c.legalNotice && <p className="legal-text">{c.legalNotice}</p>}
    </InfoPage>
  );
}
