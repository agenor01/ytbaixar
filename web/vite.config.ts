import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Em dev a página roda no Vite (5173) e conversa com o server.js (8787) pelo proxy.
// No build, o server.js serve a pasta dist direto.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
})
