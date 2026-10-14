import InfoPage from '../../src/InfoPage';
import { siteConfig, ConfigNotice } from '../../src/site-config';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const c = await siteConfig();
  return (
    <InfoPage title="Datenschutz">
      {!c.reviewed && <ConfigNotice />}
      {c.privacyNotice && <p className="legal-text">{c.privacyNotice}</p>}
      <section>
        <h2>So arbeitet EstateAtlas technisch</h2>
        <p>
          Kontodaten, Immobilien, Fotos, Dokumente und Rechercheaufträge liegen in der privaten
          PostgreSQL-Datenbank. Zugriffe erfordern Anmeldung und eine passende Objektberechtigung.
          Administratoren erhalten dadurch keinen automatischen Zugriff auf deine privaten
          Immobilieninhalte.
        </p>
      </section>
      <section>
        <h2>Verbindung zu anderen Diensten</h2>
        <p>
          Die vereinfachte Karte und Schriftarten werden lokal geladen. Eine aktiv eingegebene
          Adresssuche wird an den konfigurierten Photon-Dienst gesendet. Erst beim Einschalten der
          Detailkarte lädt der Browser Kartenkacheln von OpenStreetMap, gegebenenfalls CARTO; diese
          Dienste sehen IP-Adresse und Kartenausschnitt. Die KI-Recherche übermittelt Adresse,
          Position und Objektmerkmale an OpenAI und dessen Suchdienste erst nach deiner
          ausdrücklichen Zustimmung.
        </p>
      </section>
      <section>
        <h2>Anmeldung und Speicherung auf deinem Gerät</h2>
        <p>
          Die Web-Anmeldung verwendet ein technisch notwendiges HttpOnly-Sitzungscookie mit
          höchstens sieben Tagen Laufzeit. Dashboard-Einstellungen bleiben lokal auf deinem Gerät,
          getrennt nach Konto. Die PWA speichert nur einen allgemeinen Offline-Hinweis und dessen
          Darstellung. Es gibt keine eingebauten Werbetracker oder Analyse-Cookies.
        </p>
      </section>
      <section>
        <h2>Export und Löschung</h2>
        <p>
          Unter „Mein Konto“ kannst du eigene Daten inklusive Dateien exportieren oder dein Konto
          löschen. Geteilte eigene Immobilien müssen vorher übertragen oder Freigaben entfernt
          werden. Fremde Immobilien bleiben bestehen. Löschung in der Live-Datenbank entfernt eigene
          Inhalte unmittelbar; ältere Sicherungen enthalten sie bis zur Rotation. Die konkreten
          Aufbewahrungszeiten und Betreiberinformationen stehen in der oben veröffentlichten
          Datenschutzerklärung.
        </p>
        <a href="/delete-account">Zum Löschablauf</a>
      </section>
      {c.hostingProvider && (
        <p>
          Hosting: {c.hostingProvider} · {c.hostingRegion}
        </p>
      )}
      {c.privacyEmail && (
        <p>
          Datenschutzkontakt: <a href={`mailto:${c.privacyEmail}`}>{c.privacyEmail}</a>
        </p>
      )}
    </InfoPage>
  );
}
