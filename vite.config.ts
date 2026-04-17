import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import fs from 'fs';
import express from 'express';

const julesBridgePlugin = () => ({
  name: 'jules-bridge',
  configureServer(server) {
    const app = express();
    app.use(express.json({ limit: '50mb' }));
    
    app.post('/api/jules/write', async (req, res) => {
      try {
        const { filePath, content } = req.body;
        if (!filePath || !content) {
          return res.status(400).json({ error: 'Missing filePath or content' });
        }
        
        // Ensure path is within the project directory
        const resolvedPath = path.resolve(__dirname, filePath);
        if (!resolvedPath.startsWith(__dirname)) {
          return res.status(403).json({ error: 'Forbidden path traversal' });
        }
        
        await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
        await fs.promises.writeFile(resolvedPath, content, 'utf-8');
        
        console.log(`[Jules-Bridge] Successfully wrote file: ${filePath}`);
        res.json({ success: true, path: filePath });
      } catch (err: any) {
        console.error(`[Jules-Bridge] Error writing file:`, err);
        res.status(500).json({ error: err.message });
      }
    });

    server.middlewares.use(app);
  }
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), julesBridgePlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
