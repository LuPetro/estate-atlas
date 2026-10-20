'use client';
import InfoPage from '../src/InfoPage';
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <InfoPage title="Das hat gerade nicht funktioniert.">
      <p>Bitte versuche es erneut. Bereits gespeicherte Daten bleiben erhalten.</p>
      <button className="button primary" onClick={retry}>
        Erneut versuchen
      </button>
      <a href="/">Zur Startseite</a>
    </InfoPage>
  );
}
