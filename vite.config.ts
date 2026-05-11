import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig, optimizeDeps} from 'vite';
import react from '@vitejs/plugin-react';
import { loadOddsApiKey } from './lib/loadOddsApiKey.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function addApiKeyProxy(apiKey: string) {
  return (proxy: { on: (event: string, fn: (req: { path?: string }) => void) => void }) => {
    proxy.on('proxyReq', (proxyReq) => {
      const sep = proxyReq.path?.includes('?') ? '&' : '?';
      proxyReq.path += `${sep}apiKey=${encodeURIComponent(apiKey)}`;
    });
  };
}

export default defineConfig(() => {

  const oddsApiKey = loadOddsApiKey(__dirname);
  if (!oddsApiKey && !process.env.VITE_USE_EXPRESS) {
    console.warn(
      '\n[BetHub] ODDS_API_KEY is missing or empty. Add it to .env.local in the project root, then restart the dev server.\n'
    );
  }
  return {
    base: '/bethub/',
    server: {
      port: 3000,

      host: '0.0.0.0',
      proxy: process.env.VITE_USE_EXPRESS
        ? { '/api': { target: 'http://localhost:3001', changeOrigin: true } }
        : {
            '/api/odds': {
              target: 'https://api.the-odds-api.com',
              changeOrigin: true,
              rewrite: (path) => {
                const [pathname, query = ''] = path.split('?');
                const m = pathname.match(/^\/api\/odds(?:\/([^/]+))?$/);
                const sport = m?.[1] || 'upcoming';
                return `/v4/sports/${sport}/odds` + (query ? '?' + query : '');
              },
              configure: addApiKeyProxy(oddsApiKey),
            },
            '/api/sports': {
              target: 'https://api.the-odds-api.com',
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/api\/sports/, '/v4/sports'),
              configure: addApiKeyProxy(oddsApiKey),
            },
            '/api/scores': {
              target: 'https://api.the-odds-api.com',
              changeOrigin: true,
              rewrite: (path) => {
                const [pathname, query = ''] = path.split('?');
                const m = pathname.match(/^\/api\/scores\/([^/]+)$/);
                const sport = m?.[1] ?? '';
                const q = query ? `?${query}` : '';
                return `/v4/sports/${sport}/scores${q}`;
              },
              configure: addApiKeyProxy(oddsApiKey),
            },
          },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
