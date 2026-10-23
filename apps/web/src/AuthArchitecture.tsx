'use client';

import { useState, type CSSProperties } from 'react';
import { Pause, Play } from 'lucide-react';
import styles from './AuthArchitecture.module.css';

/** All facade details use the same plane as their wall, including window frames. */
function Facade({
  width,
  height,
  entrance = false,
}: {
  width: number;
  height: number;
  entrance?: boolean;
}) {
  const bay = width / 3;
  const floor = height / 3;
  return (
    <>
      <path d={`M0 ${floor}H${width}M0 ${floor * 2}H${width}`} className={styles.floorLines} />
      <g className={styles.windows}>
        {[0, 1, 2].flatMap((row) =>
          [0, 1, 2].map((column) => {
            if (entrance && row === 2 && column === 1) return null;
            const x = bay * column + (bay - 18) / 2;
            const y = floor * row + 10;
            return (
              <g key={`${row}-${column}`} transform={`translate(${x} ${y})`}>
                <rect width="18" height="21" rx=".5" className={styles.windowRecess} />
                <rect x="2" y="2" width="14" height="17" className={styles.glass} />
                {(row + column) % 2 === 0 && (
                  <rect
                    x="2"
                    y="2"
                    width="14"
                    height="17"
                    className={styles.windowLight}
                    style={{ '--light-delay': `${-((row * 3 + column) * 2.3)}s` } as CSSProperties}
                  />
                )}
                <path d="M9 2v17M2 19h14" className={styles.windowFrame} />
                <path d="M-1 22h20" className={styles.sill} />
              </g>
            );
          }),
        )}
        {entrance && (
          <g transform={`translate(${bay + (bay - 22) / 2} ${floor * 2 + 4})`}>
            <path d={`M0 0h22v${floor - 4}H0Z`} fill="#633e32" />
            <path d={`M3 3h16v${floor - 7}H3Z`} fill="#e9c6a1" />
            <path d={`M11 3v${floor - 7}m4-12v5`} stroke="#81553e" strokeWidth="1" />
          </g>
        )}
      </g>
    </>
  );
}

export default function AuthArchitecture() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={styles.scene} data-auth-art data-paused={paused}>
      <svg viewBox="0 50 640 410" fill="none" aria-hidden="true" focusable="false">
        <path d="M30 282 318 117 610 282 322 449Z" fill="#e8e3d8" opacity=".55" />
        <g className={styles.siteLines} stroke="#d4ccbd" strokeWidth=".8">
          <path d="m6 259 319-182 309 180M9 297 326 116l309 181M48 320 365 139M92 345 409 164M140 370 456 191M3 222l313 179M55 192l315 180M107 162l313 180M159 132l313 180M211 102l313 180" />
        </g>
        <path
          className={styles.shadow}
          d="m128 283 169-96 174 101-168 96Z"
          fill="#b8ad97"
          opacity=".2"
        />
        <path d="m190 307-39 23 22 13 40-23Z" fill="#faf6ec" opacity=".8" />

        <g className={styles.backHouse} data-art-part="back-house">
          <path
            className={styles.outline}
            d="M313 253V131l98-56 107 61v122l-98 57-107-62m0-122 107 62 98-57m-98 57v122"
            pathLength="1"
          />
          <g className={styles.surfaces}>
            <path d="m313 131 98-56 107 61-98 57Z" fill="#f8f5ee" />
            <path d="m313 131 107 62v122l-107-62Z" fill="#e7dfcf" />
            <path d="m420 193 98-57v122l-98 57Z" fill="#c5baa6" />
            <path d="m331 132 80-45 88 50-79 45Z" stroke="#d3c8b5" strokeWidth="1.2" />
          </g>
          <g transform="matrix(1 .579439 0 1 313 131)">
            <Facade width={107} height={122} />
          </g>
          <g transform="matrix(1 -.581633 0 1 420 193)">
            <Facade width={98} height={122} />
          </g>
        </g>

        <g className={styles.frontHouse} data-art-part="front-house">
          <path
            className={styles.outline}
            d="M141 278V165l112-64 115 66v113l-112 65-115-67m0-113 115 67 112-65m-112 65v113"
            pathLength="1"
          />
          <g className={styles.surfaces}>
            <path d="m141 165 112-64 115 66-112 65Z" fill="#de8e6e" />
            <path d="m141 165 115 67v113l-115-67Z" fill="#c16d50" />
            <path d="m256 232 112-65v113l-112 65Z" fill="#9d4e38" />
            <path d="m157 166 96-55 98 56-95 56Z" stroke="#edb296" strokeWidth="1.3" />
            <path d="m141 278 115 67 112-65" stroke="#81452f" strokeWidth="2" />
          </g>
          <g transform="matrix(1 .582609 0 1 141 165)">
            <Facade width={115} height={113} entrance />
          </g>
          <g transform="matrix(1 -.580357 0 1 256 232)">
            <Facade width={112} height={113} />
          </g>
        </g>

        <g className={styles.dimensions} stroke="#b9af9e" strokeWidth="1">
          <path
            d="M101 146v121m-5-124 10 6m-10 115 10 6M390 328l116-67m-119 64 6 8m110-76 6 8"
            pathLength="1"
          />
        </g>
        <ellipse cx="120" cy="318" rx="12" ry="4" fill="#747e5d" opacity=".12" />
        <path d="M120 299v19" stroke="#747e5d" strokeWidth="2" />
        <g transform="translate(120 305)">
          <g className={styles.treeCrown}>
            <circle cx="-9" cy="-13" r="6" fill="#9b9d70" />
            <circle cy="-8" r="9" fill="#747e5d" />
          </g>
        </g>
        <ellipse cx="548" cy="298" rx="12" ry="4" fill="#747e5d" opacity=".12" />
        <path d="M548 273v24" stroke="#747e5d" strokeWidth="2" />
        <g transform="translate(548 280)">
          <g className={`${styles.treeCrown} ${styles.treeRight}`} data-art-part="right-tree">
            <circle cy="-16" r="11" fill="#9b9d70" />
            <circle cx="-3" cy="-20" r="5" fill="#b6b98c" opacity=".65" />
          </g>
        </g>
      </svg>
      <div className={styles.caption}>
        <span>ESTATEATLAS — 01</span>
        <button
          type="button"
          className={styles.motionControl}
          onClick={() => setPaused(!paused)}
          aria-label={paused ? 'Hausanimation fortsetzen' : 'Hausanimation pausieren'}
        >
          {paused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
          <span>{paused ? 'Fortsetzen' : 'Pause'}</span>
        </button>
      </div>
    </div>
  );
}
