import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  imports: {
    presets: ['react'],
  },
  manifest: {
    name: 'Domain Powertools',
    permissions: ['storage'],
  }
});
