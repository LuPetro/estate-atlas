import React, { useRef, useState } from 'react';
import { View, Text, Pressable, PanResponder, StyleSheet, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { Region } from 'react-native-maps';
import { countryPaths, projectPosition, unprojectPosition } from '@estate-atlas/shared/map';

type Point = { id: string; title: string; latitude: number; longitude: number; count?: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const Countries = React.memo(function Countries() {
  return (
    <>
      {countryPaths.map((country) => (
        <Path
          key={country.code}
          d={country.d}
          fill="#dce8df"
          stroke="#fff"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          fillRule="evenodd"
        />
      ))}
    </>
  );
});
export default function SimpleMap({
  region,
  onRegionChange,
  points,
  onPressPoint,
  onPressMap,
}: {
  region: Region;
  onRegionChange: (region: Region) => void;
  points: Point[];
  onPressPoint: (id: string) => void;
  onPressMap?: (position: { latitude: number; longitude: number }) => void;
}) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const center = projectPosition(region.latitude, region.longitude);
  const span = clamp(region.longitudeDelta / 360, 1 / 64, 1);
  const height = (span * size.height) / size.width;
  const viewport = { x: center.x - span / 2, y: center.y - height / 2, span, height };
  const latest = useRef({ viewport, size, region, onRegionChange });
  latest.current = { viewport, size, region, onRegionChange };
  const gesture = useRef({ ...latest.current, distance: 0 });
  const dragged = useRef(false);
  const change = (x: number, y: number, width: number) => {
    const position = unprojectPosition(clamp(x, 0, 1), clamp(y, 0.01, 0.99));
    latest.current.onRegionChange({
      ...position,
      longitudeDelta: width * 360,
      latitudeDelta: width * 180,
    });
  };
  const distance = (touches: { pageX: number; pageY: number }[]) =>
    touches.length < 2
      ? 0
      : Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, state) =>
        Math.abs(state.dx) + Math.abs(state.dy) > 5 || state.numberActiveTouches > 1,
      onPanResponderGrant: (event) => {
        dragged.current = true;
        gesture.current = { ...latest.current, distance: distance(event.nativeEvent.touches) };
      },
      onPanResponderMove: (event, state) => {
        dragged.current = true;
        const start = gesture.current;
        const currentDistance = distance(event.nativeEvent.touches);
        const scale = start.distance && currentDistance ? start.distance / currentDistance : 1;
        const width = clamp(start.viewport.span * scale, 1 / 64, 1);
        const p = projectPosition(start.region.latitude, start.region.longitude);
        change(
          p.x - (state.dx / start.size.width) * start.viewport.span,
          p.y - (state.dy / start.size.width) * start.viewport.span,
          width,
        );
      },
    }),
  ).current;
  return (
    <View
      style={styles.map}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      onTouchStart={() => {
        dragged.current = false;
      }}
      {...responder.panHandlers}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`${viewport.x * 1000} ${viewport.y * 1000} ${span * 1000} ${height * 1000}`}
        accessibilityLabel="Vereinfachte Weltkarte"
        onPress={(event) => {
          if (dragged.current || !onPressMap) return;
          const { locationX, locationY } = event.nativeEvent;
          onPressMap(
            unprojectPosition(
              clamp(viewport.x + (locationX / size.width) * span, 0, 1),
              clamp(viewport.y + (locationY / size.height) * height, 0.01, 0.99),
            ),
          );
        }}
      >
        <Countries />
      </Svg>
      {points.map((point) => {
        const p = projectPosition(point.latitude, point.longitude);
        const left = ((p.x - viewport.x) / span) * size.width;
        const top = ((p.y - viewport.y) / height) * size.height;
        if (left < -20 || left > size.width + 20 || top < -20 || top > size.height + 20)
          return null;
        return (
          <Pressable
            key={point.id}
            accessibilityRole="button"
            accessibilityLabel={point.title}
            hitSlop={4}
            style={[styles.pin, { left: left - 18, top: top - 18 }]}
            onPress={() => onPressPoint(point.id)}
          >
            <Text style={styles.pinText}>{point.count && point.count > 1 ? point.count : '●'}</Text>
          </Pressable>
        );
      })}
      <View style={styles.zoom}>
        {[
          { label: 'Vergrößern', text: '+', factor: 0.5 },
          { label: 'Verkleinern', text: '−', factor: 2 },
        ].map((button) => (
          <Pressable
            key={button.label}
            accessibilityRole="button"
            accessibilityLabel={button.label}
            style={styles.zoomButton}
            onPress={() => change(center.x, center.y, clamp(span * button.factor, 1 / 64, 1))}
          >
            <Text style={styles.zoomText}>{button.text}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Kartendaten: Natural Earth"
        style={styles.attribution}
        onPress={() => Linking.openURL('https://www.naturalearthdata.com/about/terms-of-use/')}
      >
        <Text style={styles.caption}>Natural Earth</Text>
      </Pressable>
    </View>
  );
}
export function MapModeControl({ detail, onPress }: { detail: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: detail }}
      style={styles.mode}
      onPress={onPress}
    >
      <Text style={styles.modeText}>{detail ? 'Vereinfacht anzeigen' : 'Details anzeigen'}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: '#f1f6f5', overflow: 'hidden' },
  mode: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7e3d5',
    borderRadius: 12,
    padding: 12,
    minHeight: 44,
  },
  modeText: { color: '#26715b', fontWeight: '600', fontSize: 12 },
  pin: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#14836f',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: { color: '#fff', fontWeight: '700' },
  zoom: { position: 'absolute', left: 12, top: 12, backgroundColor: '#fff', borderRadius: 10 },
  zoomButton: { paddingHorizontal: 13, paddingVertical: 5, minWidth: 44, minHeight: 44 },
  zoomText: { fontSize: 22, color: '#26715b' },
  attribution: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#ffffffdd',
    padding: 3,
  },
  caption: { fontSize: 10, color: '#38523e' },
});
