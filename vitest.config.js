import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Test-only config. Does NOT affect the app build (vite.config.js is untouched).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['tests/setup.js'],
  },
})
