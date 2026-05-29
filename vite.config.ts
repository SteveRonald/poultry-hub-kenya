import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import dotenv from "dotenv";
import { componentTagger } from "lovable-tagger";

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "backend/.env") });

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  root: path.resolve(__dirname, "frontend"),
  server: {
    host: "::",
    port: 8080,
    strictPort: false,
    hmr: {
      protocol: 'ws',
      port: 8080,
    },
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      ".ngrok.io",
      ".ngrok-free.app",
      ".ngrok.app"
    ],
    middlewareMode: false,
    fs: {
      strict: false,
      allow: ['..'],
    },
  },
  logLevel: 'info', // Show Vite logging
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./frontend/src"),
    },
    dedupe: ['socket.io-client'],
  },
  optimizeDeps: {
    force: true, // Force re-optimization to fix chunk errors
    include: ['socket.io-client'],
    exclude: [],
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
    'import.meta.env.VITE_WHATSAPP_SUPPORT_NUMBER': JSON.stringify(
      process.env.VITE_WHATSAPP_SUPPORT_NUMBER || process.env.WHATSAPP_SUPPORT_NUMBER || ''
    ),
  },
}));
