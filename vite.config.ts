import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { consoleForwardPlugin } from './console-forward-plugin';

export default defineConfig(({ mode }) => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        ...(mode === 'lan-https' ? [basicSsl()] : []),
        react(),
        consoleForwardPlugin(),
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
