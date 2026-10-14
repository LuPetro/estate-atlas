import InfoPage from '../../src/InfoPage';
import { siteConfig } from '../../src/site-config';
export const dynamic = 'force-dynamic';
export default async function Page() {
  const c = await siteConfig();
  return (
    <InfoPage title="Hilfe & Kontakt">
      <section>
        <h2>Probleme mit der Anmeldung?</h2>
        <p>
          Nutze „Passwort vergessen“ auf der Anmeldeseite. Wenn Zwei-Faktor-Anmeldung aktiv ist,
          brauchst du zusätzlich den Code deiner Authenticator-App oder einen gespeicherten
          Wiederherstellungscode.
        </p>
        <a href="/account-action">Passwort zurücksetzen</a>
      </section>
      <section>
        <h2>EstateAtlas auf dem Handy</h2>
        <p>
          Die Web-App passt sich deinem Bildschirm an. Du kannst sie auch auf dem Startbildschirm
          installieren.
        </p>
        <a href="/install">Installationsanleitung öffnen</a>
      </section>
      <section>
        <h2>Fehler melden</h2>
        <p>
          Nenne die betroffene Funktion, den ungefähren Zeitpunkt und die angezeigte Fehlermeldung.
          Schicke keine Passwörter, Anmeldecodes, API-Schlüssel oder privaten Dokumente.
        </p>
        {c.supportEmail ? (
          <a
            className="button primary"
            href={`mailto:${c.supportEmail}?subject=EstateAtlas%20Support`}
          >
            Support kontaktieren
          </a>
        ) : (
          <p>Der öffentliche Supportkontakt wird vor der Veröffentlichung ergänzt.</p>
        )}
      </section>
      <section>
        <h2>Daten mitnehmen oder Konto löschen</h2>
        <p>
          Export und Löschung findest du unter „Mein Konto“. Du bestätigst beide Aktionen mit deinem
          aktuellen Passwort und gegebenenfalls dem Zwei-Faktor-Code.
        </p>
        <a href="/delete-account">Löschablauf ansehen</a>
      </section>
    </InfoPage>
  );
}
