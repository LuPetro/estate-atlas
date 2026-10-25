import type { PropertyType } from '@estate-atlas/shared';
import {
  propertyArtworkViewBox,
  propertyArtworkPaths,
  propertyArtworkColour,
} from '@estate-atlas/shared/artwork';

/** A symbolic property type, never a photograph of the user's building. */
export default function PropertyArtwork({ type }: { type: PropertyType }) {
  return (
    <svg
      className="property-artwork"
      viewBox={propertyArtworkViewBox}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {propertyArtworkPaths[type].map((path, index) => (
        <path
          key={index}
          d={path.d}
          fill={propertyArtworkColour(path.fill)}
          stroke={propertyArtworkColour(path.stroke)}
          strokeWidth={path.strokeWidth}
          strokeDasharray={path.strokeDasharray}
        />
      ))}
    </svg>
  );
}
