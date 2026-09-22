import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 是以子路徑（/eco-grid-ems/）服務，用相對路徑打包才能正確載入資產
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      // 台電的兩支資料（供需摘要、機組出力明細）都改由後端代抓（見 server/src/taipowerProxy.ts），
      // 不在這裡設 proxy：上游沒開 CORS，只設 dev proxy 的話正式環境會是 404。
      '/api/moenv': {
        target: 'https://data.moenv.gov.tw',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/moenv/, ''),
      },
    },
  },
})
