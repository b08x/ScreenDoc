import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isDevelopment = mode === 'development';

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: {
          host: 'localhost'
        }
      },
      plugins: [react()],
      define: {
        // Only expose OLLAMA_BASE_URL (non-sensitive configuration)
        // API keys should be provided by users via ProviderSetupPage
        'process.env.OLLAMA_BASE_URL': JSON.stringify(env.OLLAMA_BASE_URL || 'http://localhost:11434'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src')
        }
      },
      build: {
        outDir: 'dist',
        sourcemap: isDevelopment,
        minify: isDevelopment ? false : 'terser',
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.debug']
          }
        },
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'ai-vendor': ['ai', '@ai-sdk/google', '@ai-sdk/openai', '@ai-sdk/anthropic', '@ai-sdk/mistral', '@openrouter/ai-sdk-provider', 'ollama-ai-provider-v2'],
              'heavy-vendor': ['mermaid', 'jszip'],
              'markdown-vendor': ['streamdown']
            }
          }
        },
        chunkSizeWarningLimit: 1000
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'classnames', 'dayjs']
      }
    };
});
