import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      ".ngrok.io",
      ".ngrok-free.app",
      ".ngrok.app"
    ],
  },
  logLevel: 'error', // Reduce Vite logging
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Remove console.log statements in production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
      },
    },
    // Source maps only in development
    sourcemap: mode === 'development',
  },
  define: {
    // Ensure environment variables are properly set
    'import.meta.env.DEV': mode === 'development',
    'import.meta.env.PROD': mode === 'production',
  },
}));
