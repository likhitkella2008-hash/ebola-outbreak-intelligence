import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://ebola-outbreak-intelligence.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
