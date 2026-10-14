import InfoPage from '../../src/InfoPage';
import { siteConfig, ConfigNotice } from '../../src/site-config';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const c = await siteConfig();
  return (
    <InfoPage title="Nutzungshinweise">
      {!c.reviewed && <ConfigNotice />}
      {c.terms && <p className="legal-text">{c.terms}</p>}
      <section>
        <h2>Werte und Recherche</h2>
        <p>
          Gespeicherte Marktwerte sind deine eigenen Angaben oder von dir übernommene
          Recherchevorschläge. Recherchen beziehen sich auf veröffentlichte Angebotspreise und
          bilden keine garantierten Verkaufspreise ab. Quellen können unvollständig, veraltet oder
          widersprüchlich sein. Prüfe das Ergebnis und seine Einschränkungen, bevor du es
          übernimmst.
        </p>
      </section>
      <section>
        <h2>Zusammenarbeit</h2>
        <p>
          Teile Einladungen nur mit den vorgesehenen Personen und prüfe die gewählte Rolle.
          Eigentümer können Freigaben zurücknehmen. Bereits heruntergeladene Kopien bleiben bei den
          Empfängern.
        </p>
      </section>
    </InfoPage>
  );
}
