import InfoPage from '../src/InfoPage';
export default function NotFound() {
  return (
    <InfoPage title="Diese Seite gibt es nicht.">
      <p>Öffne dein Portfolio oder die Hilfe, um weiterzumachen.</p>
      <a className="button primary" href="/">
        Zum Portfolio
      </a>
    </InfoPage>
  );
}
