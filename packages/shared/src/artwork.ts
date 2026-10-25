import type { PropertyType } from './index';

/** Original architectural drawings. Coordinates and colours are shared by both clients. */
export const propertyArtworkViewBox = '0 0 280 180';
export const propertyArtworkPalette = {
  paper: '#f3f1e9',
  line: '#858475',
  faint: '#d5d2c5',
  wall: '#fcfaf4',
  side: '#e4dfd1',
  roof: '#b78168',
  roofEdge: '#976b57',
  glass: '#c6d4cb',
  frame: '#71877b',
  green: '#adb797',
  field: '#dde2cc',
  ground: '#e9e6da',
} as const;

type Colour = keyof typeof propertyArtworkPalette;
type ArtworkPath = {
  d: string;
  fill: Colour | 'none';
  stroke: Colour | 'none';
  strokeWidth: number;
  strokeDasharray?: string;
};
const shape = (
  d: string,
  fill: ArtworkPath['fill'] = 'none',
  stroke: ArtworkPath['stroke'] = 'line',
  strokeWidth = 1,
): ArtworkPath => ({ d, fill, stroke, strokeWidth });
const rectangle = (x: number, y: number, width: number, height: number) =>
  `M${x} ${y}h${width}v${height}h-${width}Z`;

// Facade windows are drawn in a single plane; the narrow side uses its own projection.
const apartmentWindows = [68, 94, 120].flatMap((y) =>
  [89, 115, 141].flatMap((x) =>
    y === 120 && x === 115
      ? []
      : [
          shape(rectangle(x, y, 14, 18), 'glass', 'frame'),
          shape(`M${x + 7} ${y}v18M${x - 2} ${y + 20}h18`, 'none', 'frame', 0.8),
        ],
  ),
);

export const propertyArtworkPaths: Record<PropertyType, readonly ArtworkPath[]> = {
  apartment: [
    shape('M55 150h148l-24 13H77Z', 'ground', 'none'),
    shape('M42 151h178', 'none', 'faint'),
    shape('M163 55l26-15v96l-26 15Z', 'side'),
    shape('M77 55h86v96H77Z', 'wall'),
    shape('M73 54l28-16h92l-28 16Z', 'side'),
    shape('M73 54h92v5H73Z', 'wall'),
    shape('M165 54l28-16v5l-28 16Z', 'side'),
    shape('M83 87h74M83 113h74', 'none', 'faint', 0.8),
    ...apartmentWindows,
    shape('M115 123h14v28h-14Z', 'roof', 'roofEdge'),
    shape('M122 127v20m3-7v4', 'none', 'wall', 0.8),
    shape('M172 68l9-5v17l-9 5Zm0 26 9-5v17l-9 5Zm0 26 9-5v17l-9 5Z', 'glass', 'frame'),
    shape('M73 151h94m-57 4h24m-28 4h32', 'none', 'line'),
    shape('M208 151v-11m-8 0c-3-13 7-17 8-24 1 7 11 11 8 24Z', 'green'),
  ],
  house: [
    shape('M59 150l91 10 54-31-86-10Z', 'ground', 'none'),
    shape('M42 151h178', 'none', 'faint'),
    shape('M156 83l28-16v64l-28 16Z', 'side'),
    shape('M78 83l39-35 39 35v64H78Z', 'wall'),
    shape('M117 45l28-16 45 40-28 16Z', 'roof', 'roofEdge'),
    shape('M72 85l45-40 45 40', 'none', 'roofEdge', 2.5),
    shape('M140 47V30l8-5v29', 'side', 'roofEdge'),
    shape('M138 29l9-5 4 3-9 5Z', 'wall', 'roofEdge'),
    shape('M108 73h18v13h-18Z', 'glass', 'frame'),
    shape('M117 73v13M91 99h20v24H91Z', 'glass', 'frame'),
    shape('M101 99v24m-12 2h24', 'none', 'frame', 0.8),
    shape('M127 110h17v37h-17Z', 'roof', 'roofEdge'),
    shape('M131 114h9v13h-9Z', 'glass', 'frame', 0.8),
    shape('M140 134v4', 'none', 'wall'),
    shape('M165 91l11-6v22l-11 6Z', 'glass', 'frame'),
    shape('M74 147h85m-35 5h25m-29 5h33', 'none', 'line'),
    shape('M55 151v-18m-9-1c-5-12 4-17 9-26 5 9 14 14 9 26Z', 'green'),
  ],
  commercial: [
    shape('M43 150h162l-22 13H64Z', 'ground', 'none'),
    shape('M36 151h193', 'none', 'faint'),
    shape('M181 79l25-15v72l-25 15Z', 'side'),
    shape('M61 79h120v72H61Z', 'wall'),
    shape('M57 74l27-16h126l-27 16Z', 'side'),
    shape('M57 74h126v10H57Z', 'wall'),
    shape('M183 74l27-16v10l-27 16Z', 'side'),
    shape('M71 94h42v48H71Zm61 0h39v48h-39Z', 'glass', 'frame'),
    shape('M92 94v48m-21-10h42m33-38v48m13-48v48', 'none', 'frame', 0.9),
    shape('M118 101h10v50h-10Z', 'roof', 'roofEdge'),
    shape('M123 105v29m2 5v4', 'none', 'wall'),
    shape('M68 88h107v5H68Z', 'roof', 'roofEdge', 0.8),
    shape('M189 89l10-6v29l-10 6Z', 'glass', 'frame'),
    shape('M189 122l10-6m-10 13 10-6', 'none', 'faint'),
    shape('M57 151h129m-70 4h15', 'none', 'line'),
    shape('M44 151v-9m-5 0h10l2-12H37Z', 'green'),
  ],
  land: [
    shape('M46 112l93-66 99 45-81 66Z', 'ground', 'none'),
    shape('M40 130l107 38 94-62', 'none', 'faint'),
    shape('M58 109l77-51 87 39-72 55Z', 'field'),
    { ...shape('M66 108l70-43 77 34-64 46Z', 'none', 'frame'), strokeDasharray: '4 4' },
    shape('M89 111l48-30m-32 36 48-30m-32 37 48-30m-32 37 48-30', 'none', 'green', 1.2),
    shape('M58 109v-9m77-42v-9m87 48v-9m-72 64v-9', 'none', 'roofEdge', 1.5),
    shape('M55 100h6m71-51h6m81 39h6m-78 55h6', 'none', 'roofEdge', 1.5),
    shape('M68 133l70 25m-71-28 2 6m67 19 3 6', 'none', 'line', 0.8),
    shape('M218 63V37m-5 6 5-6 5 6', 'none', 'line'),
    shape('M40 96v-13m-8 0c-3-11 5-15 8-22 3 7 11 11 8 22Z', 'green'),
  ],
};

export function propertyArtworkColour(colour: Colour | 'none') {
  return colour === 'none' ? 'none' : propertyArtworkPalette[colour];
}
