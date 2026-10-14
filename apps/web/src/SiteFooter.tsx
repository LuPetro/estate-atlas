export default function SiteFooter() {
  return (
    <footer className="site-footer" aria-label="Service und Rechtliches">
      <span>EstateAtlas</span>
      <nav aria-label="Service">
        <a href="/install">App installieren</a>
        <a href="/support">Hilfe</a>
        <a href="/privacy">Datenschutz</a>
        <a href="/legal">Impressum</a>
        <a href="/terms">Nutzung</a>
        <a href="/delete-account">Konto löschen</a>
      </nav>
    </footer>
  );
}
