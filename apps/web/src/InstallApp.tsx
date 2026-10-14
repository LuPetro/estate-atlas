'use client';
import { useEffect, useState } from 'react';
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function InstallApp() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    setInstalled(
      window.matchMedia('(display-mode: standalone)').matches ||
        !!(navigator as Navigator & { standalone?: boolean }).standalone,
    );
    const ready = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    const done = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', ready);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('beforeinstallprompt', ready);
      window.removeEventListener('appinstalled', done);
    };
  }, []);
  if (installed) return <p className="account-notice">EstateAtlas ist bereits als App geöffnet.</p>;
  return (
    <>
      {event && (
        <button
          className="button primary"
          onClick={async () => {
            await event.prompt();
            await event.userChoice;
            setEvent(null);
          }}
        >
          EstateAtlas installieren
        </button>
      )}
      <section>
        <h2>Auf deinem iPhone oder iPad</h2>
        <p>
          Öffne EstateAtlas in Safari. Tippe auf „Teilen“ und dann „Zum Home-Bildschirm“. Bestätige
          mit „Hinzufügen“. Danach öffnest du EstateAtlas über das neue Symbol.
        </p>
      </section>
      <section>
        <h2>Android und Computer</h2>
        <p>
          Öffne EstateAtlas in einem Browser wie Chrome oder Edge. Wähle im Browsermenü „App
          installieren“ oder „Zum Startbildschirm hinzufügen“. Falls dein Browser dies unterstützt,
          erscheint hier zusätzlich ein Installationsbutton.
        </p>
      </section>
      <section>
        <h2>Dein Portfolio bleibt geschützt</h2>
        <p>
          Die Web-App braucht eine Internetverbindung für Anmeldung, Immobilien und Dateien. Offline
          erscheint nur ein allgemeiner Hinweis. Die Installation speichert keine Kopie deiner
          Portfoliodaten.
        </p>
      </section>
    </>
  );
}
