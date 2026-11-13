import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : '/fitness-app/',
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
    manifest: {
      name: 'My Fitness 筋トレ記録',
      short_name: 'My Fitness',
      lang: 'ja',
      description: '自分専用の筋トレ記録',
      theme_color: '#284f3b',
      background_color: '#f5f6f2',
      display: 'standalone',
      start_url: './',
      scope: './',
      icons: [
        {src: 'icon-192.png', sizes: '192x192', type: 'image/png'},
        {src: 'icon-512.png', sizes: '512x512', type: 'image/png'},
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,png,ico,svg,webmanifest}'],
      navigateFallback: 'index.html',
    },
  })],
}))
