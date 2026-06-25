import { defineConfig } from 'vite';
import { milltinaAssetsPlugin } from './vite-assets-plugin';

export default defineConfig({
  plugins: [milltinaAssetsPlugin()],
  server: {
    port: 5174,
    open: true,
    fs: {
      allow: ['..', '../..', '../../asset'],
    },
  },
});
