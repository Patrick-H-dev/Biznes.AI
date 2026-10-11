import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Względne ścieżki: aplikacja działa pod dowolnym adresem, także pod /Biznes.AI/ na GitHub Pages
  base: './',
  // exceljs i jsPDF są ładowane leniwie, dopiero przy imporcie/eksporcie
  build: { chunkSizeWarningLimit: 1000 },
  // Znaki spoza ASCII w kodzie bibliotek zapisujemy jako sekwencje \u… (bezpieczne przy każdym serwowaniu)
  esbuild: { charset: 'ascii' },
  test: {
    environment: 'node',
  },
});
