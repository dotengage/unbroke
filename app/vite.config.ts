import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' lets the build run from any sub-path (GitHub Pages, Vercel, Netlify…)
export default defineConfig({
  base: './',
  plugins: [react()],
  // the onboarding screen imports ../apps-script/Code.gs so friends can copy the script
  server: { fs: { allow: ['..'] } },
  build: {
    chunkSizeWarningLimit: 900,
  },
});
