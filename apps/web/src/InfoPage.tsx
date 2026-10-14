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
        <a className="brand" href="/">
          EstateAtlas
        </a>
        <a href="/">Zum Portfolio</a>
      </header>
      <main>
        <p className="eyebrow">DEIN IMMOBILIEN-WORKSPACE</p>
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
