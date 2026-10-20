import type { Metadata } from 'next';
import {
  ArrowRight,
  ChartNoAxesCombined,
  Files,
  LockKeyhole,
  MapPinned,
  UsersRound,
} from 'lucide-react';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Immobilienportfolio für private Eigentümer',
  description:
    'Behalte deine Immobilien, eigene Wertnotizen, Mietzeiträume und Unterlagen an einem privaten Ort im Blick.',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Deine Immobilien. Ein klarer Überblick. | EstateAtlas',
    description:
      'Ordne Immobilien, Wertnotizen, Mietzeiträume und Unterlagen in deinem privaten Portfolio.',
    url: 'https://estateatlas.app/',
    siteName: 'EstateAtlas',
    locale: 'de_AT',
    type: 'website',
  },
};

const features = [
  {
    icon: MapPinned,
    title: 'Alle Objekte auf einen Blick',
    text: 'Fasse Wohnungen, Häuser, Grundstücke und Gewerbeobjekte in einem privaten Portfolio zusammen.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Deine Werte, sauber festgehalten',
    text: 'Notiere eigene Marktwerte und verfolge ihre Entwicklung, ohne automatische Schätzungen als Fakten auszugeben.',
  },
  {
    icon: Files,
    title: 'Unterlagen beim Objekt',
    text: 'Bewahre wichtige Dateien und Notizen dort auf, wo du sie später wieder brauchst.',
  },
  {
    icon: UsersRound,
    title: 'Gemeinsam organisiert',
    text: 'Teile ausgewählte Immobilien mit vertrauten Personen und verwalte Zugriffsrechte.',
  },
];

function Brand() {
  return (
    <a className={styles.brand} href="/" aria-label="EstateAtlas Startseite">
      <span className={styles.mark} aria-hidden="true">
        ◈
      </span>
      <span>EstateAtlas<span className={styles.period}>.</span></span>
    </a>
  );
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Brand />
        <nav aria-label="Hauptnavigation">
          <a href="#funktionen">Funktionen</a>
          <a href="/privacy">Datenschutz</a>
          <a className={styles.signIn} href="/portfolio">Anmelden</a>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span /> DEIN PRIVATES IMMOBILIENPORTFOLIO</p>
          <h1>Deine Immobilien.<br />Ein klarer Überblick.</h1>
          <p className={styles.lede}>
            Objekte, eigene Wertnotizen, Mietzeiträume und Unterlagen – zusammen an einem privaten Ort.
          </p>
          <div className={styles.actions}>
            <a className={styles.primary} href="/portfolio?register=1">
              Konto erstellen <ArrowRight size={17} />
            </a>
            <a className={styles.secondary} href="#funktionen">So funktioniert’s</a>
          </div>
          <p className={styles.signupNote}>Erstelle dein Konto direkt mit deiner E-Mail-Adresse.</p>
          <p className={styles.privacyNote}><LockKeyhole size={14} /> Dein Portfolio ist nur für dich und von dir eingeladene Personen sichtbar.</p>
        </div>

        <div className={styles.preview} aria-label="Illustration einer Portfolio-Übersicht">
          <div className={styles.previewTop}>
            <div><span className={styles.previewDot} /><span>MEIN PORTFOLIO</span></div>
            <span className={styles.previewLabel}>BEISPIELANSICHT</span>
          </div>
          <div className={styles.previewHeading}>
            <div><span className={styles.miniEyebrow}>ÜBERSICHT</span><h2>Alles an einem Ort.</h2></div>
            <span className={styles.compass}>⌖</span>
          </div>
          <div className={styles.mapCard} aria-hidden="true">
            <div className={styles.mapGrid} />
            <span className={`${styles.pin} ${styles.pinOne}`} />
            <span className={`${styles.pin} ${styles.pinTwo}`} />
            <span className={`${styles.pin} ${styles.pinThree}`} />
            <span className={styles.mapCaption}>DEINE OBJEKTE · DEINE KARTE</span>
          </div>
          <div className={styles.previewTiles}>
            <div><span>OBJEKTE</span><strong>Portfolio</strong></div>
            <div><span>VERMIETUNG</span><strong>Mietzeiträume</strong></div>
            <div><span>UNTERLAGEN</span><strong>Beim Objekt</strong></div>
          </div>
          <p className={styles.previewDisclaimer}>Illustration der Funktionen, keine echten Immobiliendaten.</p>
        </div>
      </section>

      <section className={styles.valueStrip} aria-label="EstateAtlas in Kürze">
        <p>Für private Eigentümer</p><span />
        <p>Werte, die du selbst pflegst</p><span />
        <p>Web-App, auch installierbar</p>
      </section>

      <section id="funktionen" className={styles.features}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>WENIGER SUCHEN. MEHR ÜBERBLICK.</p>
          <h2>Dein Immobilienalltag, besser geordnet.</h2>
          <p>EstateAtlas hilft dir, den Überblick über deinen Bestand und die dazugehörigen Informationen zu behalten.</p>
        </div>
        <div className={styles.featureGrid}>
          {features.map(({ icon: Icon, title, text }) => (
            <article className={styles.feature} key={title}>
              <span className={styles.featureIcon}><Icon size={20} strokeWidth={1.7} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.closing}>
        <div>
          <p className={styles.eyebrow}>ESTATEATLAS</p>
          <h2>Mach aus vielen Einzelinfos einen Überblick.</h2>
        </div>
        <a className={styles.primary} href="/portfolio?register=1">Konto erstellen <ArrowRight size={17} /></a>
      </section>
    </main>
  );
}
