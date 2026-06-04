import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  // VITE_API_URL defaults to localhost:8000 when not set in environment
  // The actual value comes from .env.development (VITE_API_URL=http://localhost:8000)
  // define is used only as a fallback default for production builds
})
