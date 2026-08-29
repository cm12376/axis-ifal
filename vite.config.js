import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    build: {
        outDir: 'dist'
    },
    server: {
        proxy: {
            '/api': 'http://localhost:3001'
        }
    },
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icons/*.png'],
            manifest: false,
            workbox: {
                importScripts: ['/push-handler.js'],
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/api\//],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/cdn\.tailwindcss\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: { cacheName: 'tailwind-cdn', expiration: { maxEntries: 5, maxAgeSeconds: 86400 } }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 86400 } }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: { cacheName: 'gstatic', expiration: { maxEntries: 10, maxAgeSeconds: 86400 } }
                    },
                    {
                        urlPattern: /^https:\/\/unpkg\.com\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: { cacheName: 'unpkg', expiration: { maxEntries: 20, maxAgeSeconds: 86400 } }
                    },
                    {
                        urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: { cacheName: 'jsdelivr', expiration: { maxEntries: 20, maxAgeSeconds: 86400 } }
                    },
                    {
                        urlPattern: /^https:\/\/cdnjs\.cloudflare\.com\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: { cacheName: 'cdnjs', expiration: { maxEntries: 20, maxAgeSeconds: 86400 } }
                    }
                ]
            }
        })
    ]
});
