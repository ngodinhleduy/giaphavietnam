import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { headersFile } from './src/shared/headers.ts';

/** Ghi dist/_headers từ src/shared/headers.ts, để header bảo mật của bản Cloudflare và bản Node luôn giống nhau. */
const securityHeaders = (): Plugin => ({
  name: 'gp-security-headers',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: headersFile() });
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), securityHeaders()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
