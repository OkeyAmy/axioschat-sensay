import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
import path from "path"
import { componentTagger } from "lovable-tagger"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import { fileURLToPath } from 'url'

// ESM compatible __dirname alternative
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy API requests to avoid CORS issues during development
      '/api/proxy-gemini': {
        target: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        changeOrigin: true,
        rewrite: (path) => '',
        configure: (proxy, options) => {
          // Proxy will pass custom headers from the original request
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Transfer API key from X-Gemini-API-Key to Authorization
            const apiKey = req.headers['x-gemini-api-key'];
            if (apiKey) {
              proxyReq.setHeader('Authorization', `Bearer ${apiKey}`);
            }
          });
        },
      },
      // Proxy backend Flask endpoints for function calling and replicate
      '/api/gemini_functions': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gemini_functions/, '/api/gemini_functions'),
      },
      '/api/replicate': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/replicate/, '/api/replicate'),
      },
    }
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    nodePolyfills({
      // Whether to polyfill `node:` protocol imports.
      protocolImports: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
