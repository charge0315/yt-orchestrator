/**
 * Vite（フロントエンド開発サーバー/ビルド）の設定。
 *
 * - 開発サーバーは外部アクセス可能にするため `host: 0.0.0.0`
 * - バックエンドAPIは `/api` を `localhost:3001` にプロキシ
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 設定リファレンス: https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // すべてのネットワークインターフェースでリッスン (IPv4とIPv6)
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
