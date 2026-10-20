import type { Property } from '@estate-atlas/shared';

/** Abstract architecture, never a photograph of the user's property. */
export default function PropertyArtwork({ type }: { type: Property['type'] }) {
  return (
    <svg
      className="property-artwork"
      viewBox="0 0 240 150"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m23 96 96-55 101 57-96 55Z" fill="var(--art-ground)" />
      <g stroke="var(--art-line)" strokeWidth=".65" opacity=".6">
        <path d="m8 104 114-66 111 64M35 120l113-66M65 137l113-66M54 76l114 66M84 59l114 66" />
      </g>
      {type === 'land' ? (
        <>
          <path
            d="m65 94 56-32 60 34-56 33Z"
            fill="var(--art-top)"
            stroke="var(--art-front)"
            strokeDasharray="4 3"
          />
          <path d="M120 57v40m-8-36 8-5 8 5-8 5Z" stroke="var(--art-side)" strokeWidth="1.5" />
          <path d="M88 99v13m73-23v13" stroke="var(--art-side)" strokeWidth="1.5" />
          <circle cx="88" cy="94" r="7" fill="var(--art-front)" />
          <circle cx="161" cy="84" r="8" fill="var(--art-front)" />
        </>
      ) : type === 'house' ? (
        <g className="art-building">
          <path d="m71 79 51-30 52 30v32l-51 30-52-30Z" fill="var(--art-front)" />
          <path d="m123 109 51-30v32l-51 30Z" fill="var(--art-side)" />
          <path d="m64 80 35-44 30 17 53 29-59 34Z" fill="var(--art-top)" />
          <path d="m99 36 53-30 30 76-53-29Z" fill="var(--art-side)" />
          <path d="m81 93 13 8v15l-13-8Zm56 18 14-8v14l-14 8Z" fill="var(--art-window)" />
          <path d="m104 113 10 6v17l-10-6Z" fill="var(--art-window)" />
          <path
            className="art-roof-line"
            d="m64 80 35-44 53-30 30 76-59 34Z"
            stroke="var(--art-highlight)"
            strokeWidth="1.2"
            pathLength={100}
          />
        </g>
      ) : (
        <g className="art-building">
          <path d="m73 49 49-28 52 30-49 29Z" fill="var(--art-top)" />
          <path d="m73 49 52 31v60l-52-30Z" fill="var(--art-front)" />
          <path d="m125 80 49-29v60l-49 29Z" fill="var(--art-side)" />
          <path
            d="m73 69 52 31 49-29m-101 20 52 30 49-29"
            stroke="var(--art-highlight)"
            strokeWidth="1"
          />
          <path d="M88 65v45m18-34v45m34-45v45m18-55v45" stroke="var(--art-line)" strokeWidth="1" />
          <path
            d={
              type === 'commercial'
                ? 'm79 91 39 23v18l-39-23Zm53 19 34-20v17l-34 20Z'
                : 'm91 79 12 7v12l-12-7Zm52 11 12-7v12l-12 7Z'
            }
            fill="var(--art-window)"
          />
          <path
            className="art-roof-line"
            d="m81 49 41-23 44 25-41 24Z"
            stroke="var(--art-highlight)"
            strokeWidth="1.2"
            pathLength={100}
          />
        </g>
      )}
      <ellipse cx="196" cy="115" rx="7" ry="2.5" fill="var(--art-line)" opacity=".2" />
      <path d="M196 100v15" stroke="var(--art-tree)" strokeWidth="1.6" />
      <circle cx="196" cy="94" r="7" fill="var(--art-tree)" />
    </svg>
  );
}
