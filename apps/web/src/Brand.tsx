import { Compass } from 'lucide-react';

export default function Brand() {
  return (
    <a className="brand" href="/" aria-label="EstateAtlas Startseite">
      <span className="brand-mark" aria-hidden="true">
        <Compass size={23} strokeWidth={1.5} />
      </span>
      <span className="brand-wordmark">
        EstateAtlas<span className="brand-period">.</span>
      </span>
    </a>
  );
}
