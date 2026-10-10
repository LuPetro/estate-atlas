import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
export default {
  expo: {
    name: 'EstateAtlas',
    slug: 'estate-atlas',
    scheme: 'estateatlas',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    ios: { bundleIdentifier: 'com.estateatlas.app', supportsTablet: true },
    android: { package: 'com.estateatlas.app' },
    plugins: [
      'expo-secure-store',
      [
        'expo-image-picker',
        {
          photosPermission: 'Fotos zu deinen Immobilien hinzufügen.',
          cameraPermission: false,
          microphonePermission: false,
        },
      ],
      'expo-document-picker',
    ],
  },
};
