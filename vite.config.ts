import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor bundle
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI framework components
          'radix-ui': [
            '@radix-ui/react-dialog', 
            '@radix-ui/react-select', 
            '@radix-ui/react-tabs', 
            '@radix-ui/react-toggle', 
            '@radix-ui/react-label', 
            '@radix-ui/react-separator', 
            '@radix-ui/react-slot'
          ],
          // Icons tree-shaken separately
          'icons': ['lucide-react'],
          // Toast notifications
          'toast': ['sonner'],
        },
      },
    },
  },
})
