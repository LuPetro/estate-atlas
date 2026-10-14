'use client';
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="de">
      <body>
        <main>
          <h1>EstateAtlas konnte nicht geladen werden.</h1>
          <p>Bitte versuche es erneut oder lade die Seite neu.</p>
          <button onClick={retry}>Erneut versuchen</button>
          <a href="/">Zur Startseite</a>
        </main>
      </body>
    </html>
  );
}
