import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import systemRoutes from './routes/system.js';
import ollamaRoutes from './routes/ollama.js';
import memoryRoutes from './routes/memory.js';
import networkRoutes from './routes/network.js';
import openclawRoutes from './routes/openclaw.js';
import logsRoutes from './routes/logs.js';
import editorRoutes from './routes/editor.js';
import settingsRoutes from './routes/settings.js';
import siriRoutes from './routes/siri.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.SERVER_PORT || '3001', 10);

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use(systemRoutes);
app.use(ollamaRoutes);
app.use(memoryRoutes);
app.use(networkRoutes);
app.use(openclawRoutes);
app.use(logsRoutes);
app.use(editorRoutes);
app.use(settingsRoutes);
app.use(siriRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Serve static files from client/dist in production
const clientDist = join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback: serve index.html for any non-API route
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(join(clientDist, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('<!DOCTYPE html><html><body><p>Client not built yet. Run npm run build in client/</p></body></html>');
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Auctorum Server] Running on http://0.0.0.0:${PORT}`);
  console.log(`[Auctorum Server] API available at http://localhost:${PORT}/api/health`);
});
