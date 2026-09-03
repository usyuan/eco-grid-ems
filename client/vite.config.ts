import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/taipower': {
        // 機組出力明細 (/data/opendata/apply/file/*) 只在這個 host 上，經實測校正
        target: 'https://service.taipower.com.tw',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/taipower/, ''),
      },
      // 電力供需摘要 (www.taipower.com.tw/d006/loadGraph/...) 改由後端代抓（見 server/src/taipowerProxy.ts），
      // 因為該 host 的 WAF 會擋掉 Vite dev proxy 的請求，詳見 client/CLAUDE.md。
      '/api/moenv': {
        target: 'https://data.moenv.gov.tw',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/moenv/, ''),
      },
    },
  },
})
