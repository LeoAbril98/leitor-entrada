import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { validatePublicSupabaseEnv } from './config/validatePublicSupabaseEnv';
import { createRomaneioEmailHandler } from './server/romaneioEmail.js';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  validatePublicSupabaseEnv(env);
  return {
    base: './',
    plugins: [
      {
        name: 'romaneio-email-api',
        configureServer(server) {
          const handler = createRomaneioEmailHandler({ env });
          server.middlewares.use('/api/romaneio-email', (req, res) => { void handler(req, res); });
        }
      },
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          cleanupOutdatedCaches: true,
        },
        manifest: {
          name: 'Leitor Contagem',
          short_name: 'Leitor',
          description: 'App para controle de contagens e volumes',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            },
            {
              src: 'pwa-192x192.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: 'pwa-icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
            },
            {
              src: 'pwa-icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-excel': ['exceljs', 'xlsx'],
            'vendor-ui': ['motion/react', 'lucide-react', 'clsx', 'tailwind-merge'],
            'vendor-react': ['react', 'react-dom'],
          }
        }
      }
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: true,
    },
  };
});
