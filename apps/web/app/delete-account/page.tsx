import InfoPage from '../../src/InfoPage';
export default function Page() {
  return (
    <InfoPage title="Dein Konto löschen">
      <p>
        Du kannst dein EstateAtlas-Konto selbst in der Web-App löschen. Melde dich an und öffne
        „Mein Konto → Konto löschen“.
      </p>
      <ol>
        <li>
          Exportiere deine Daten unter „Deine Daten mitnehmen“, wenn du eine Kopie behalten
          möchtest.
        </li>
        <li>Übertrage eigene geteilte Immobilien an ein Mitglied oder entferne deren Freigaben.</li>
        <li>
          Gib dein aktuelles Passwort, gegebenenfalls den Zwei-Faktor-Code und „KONTO LÖSCHEN“ ein.
        </li>
        <li>Bestätige die endgültige Löschung.</li>
      </ol>
      <p>
        Dein Konto, eigene Immobilien, Dateien und Zugänge werden aus der Live-Datenbank entfernt.
        Fremde Immobilien bleiben bestehen. Ältere Sicherungen können die Daten bis zur Rotation
        enthalten. Der letzte aktive Administrator muss zuerst einen weiteren Administrator
        einrichten.
      </p>
      <a className="button primary" href="/account">
        Mein Konto öffnen
      </a>
      <p>
        Kein Zugang mehr? Nutze <a href="/account-action">die Passwortwiederherstellung</a> oder{' '}
        <a href="/support">den Support</a>.
      </p>
    </InfoPage>
  );
}
