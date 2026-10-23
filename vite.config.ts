import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: '/dulce-bendicion/', // 👈 ESTA ES LA LÍNEA MÁGICA
});