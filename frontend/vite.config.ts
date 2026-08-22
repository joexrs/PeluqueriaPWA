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
        name: 'Peluqueria PWA',
        short_name: 'Peluqueria',
        start_url: '/',
        display: 'standalone',
        theme_color: '#1F4E79',
      },
    }),
  ],
})
