import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // exceljs i jsPDF są ładowane leniwie, dopiero przy imporcie/eksporcie
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'node',
  },
});
