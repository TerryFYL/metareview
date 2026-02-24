import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/pubmed': {
        target: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
        changeOrigin: true,
        rewrite: (path) => path.replace('/api/pubmed/', ''),
      },
      // AI screening — proxied to wrangler pages dev in local development
      '/api/screening': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
      // PDF data extraction
      '/api/extract': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
      // Analytics
      '/api/analytics': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
})
