import { Platform } from 'react-native';
import type { MapViewProps } from 'react-native-maps';

// Keep the native Apple/Google providers. Apple has a built-in muted style;
// Google supports local JSON styling without an additional tile subscription.
export const mapTheme: Pick<MapViewProps, 'mapType' | 'userInterfaceStyle' | 'customMapStyle'> = {
  mapType: Platform.OS === 'ios' ? 'mutedStandard' : 'standard',
  userInterfaceStyle: 'light',
  customMapStyle:
    Platform.OS === 'android'
      ? [
          { elementType: 'geometry', stylers: [{ color: '#f2f4f1' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#52695e' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e3ede5' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e1e7de' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dceae8' }] },
          { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
        ]
      : undefined,
};
