import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Peluquería & Estética - Victor Manuel Peluqueros',
        short_name: 'VM Peluqueros',
        description: 'Sistema de gestión para Peluquería & Estética - Victor Manuel Peluqueros',
        start_url: '/',
        display: 'standalone',
        theme_color: '#1F4E79',
        background_color: '#0a0f1a',
        icons: [
          {
            src: '/logo-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/logo-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})

