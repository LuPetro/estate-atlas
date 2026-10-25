import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { propertyTypeLabels, type PropertyType } from '@estate-atlas/shared';
import {
  propertyArtworkViewBox,
  propertyArtworkPalette,
  propertyArtworkPaths,
  propertyArtworkColour,
} from '@estate-atlas/shared/artwork';

export default function PropertyArtwork({
  type,
  preview = false,
}: {
  type: PropertyType;
  preview?: boolean;
}) {
  return (
    <View style={[styles.surface, preview && styles.preview]}>
      <Svg
        width={preview ? 140 : 210}
        height={preview ? 90 : 135}
        viewBox={propertyArtworkViewBox}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {propertyArtworkPaths[type].map((path, index) => (
          <Path
            key={index}
            d={path.d}
            fill={propertyArtworkColour(path.fill)}
            stroke={propertyArtworkColour(path.stroke)}
            strokeWidth={path.strokeWidth}
            strokeDasharray={path.strokeDasharray}
          />
        ))}
      </Svg>
      {preview && (
        <View style={styles.caption}>
          <Text style={styles.title}>{propertyTypeLabels[type]}</Text>
          <Text style={styles.note}>Symbolansicht im Portfolio</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: propertyArtworkPalette.paper,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    padding: 4,
  },
  preview: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 8 },
  caption: { flexShrink: 1, paddingVertical: 8, gap: 4 },
  title: { color: '#424a3e', fontSize: 14, fontWeight: '600' },
  note: { color: '#626956', fontSize: 12 },
});
