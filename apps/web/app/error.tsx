'use client';
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="info-shell">
      <h1>Das hat gerade nicht funktioniert.</h1>
      <p>Bitte versuche es erneut. Bereits gespeicherte Daten bleiben erhalten.</p>
      <button className="button primary" onClick={retry}>
        Erneut versuchen
      </button>
      <a href="/">Zur Startseite</a>
    </main>
  );
}
