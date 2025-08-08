import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  servers: {
    proxy: {
      // anything starting with /api will get proxied to Flask
      "/aoi": {
        target: "http://localhost:5000",
        changeOrigin: true,
      }
    }
  }
})
