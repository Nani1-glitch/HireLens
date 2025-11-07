import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load environment variables from .env file
    const env = loadEnv(mode, process.cwd(), '');
    const apiKey = env.GEMINI_API_KEY || '';
    
    console.log('Loading environment variables...');
    console.log('GEMINI_API_KEY found:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT FOUND');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Inject the API key into the client code
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
        'process.env.API_KEY': JSON.stringify(apiKey),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
