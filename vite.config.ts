import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function addApiKeyProxy(apiKey: string) {
  return (proxy: { on: (event: string, fn: (req: { path?: string }) => void) => void }) => {
    proxy.on('proxyReq', (proxyReq) => {
      const sep = proxyReq.path?.includes('?') ? '&' : '?';
      proxyReq.path += `${sep}apiKey=${encodeURIComponent(apiKey)}`;
    });
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const oddsApiKey = env.ODDS_API_KEY || '';

  return {
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
