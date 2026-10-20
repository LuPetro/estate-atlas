import Brand from './Brand';

export default function InfoPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="info-shell">
      <header>
        <Brand href="/" />
        <a href="/portfolio">Zum Portfolio</a>
      </header>
      <main>
        <p className="eyebrow">DEIN IMMOBILIEN-WORKSPACE</p>
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
