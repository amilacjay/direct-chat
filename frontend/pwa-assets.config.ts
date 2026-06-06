import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      sizes: [512],
      padding: 0.15,
      resizeOptions: { background: '#8B5CF6' },
    },
    apple: {
      sizes: [180],
      padding: 0.12,
      resizeOptions: { background: '#1A1820' },
    },
  },
  images: ['public/icon.svg'],
});
