import { Router } from 'express';
import { getSSHConfig, updateSSHConfig } from '../ssh.js';

const router = Router();

// GET /api/settings
router.get('/api/settings', (req, res) => {
  const config = getSSHConfig();
  res.json({
    host: config.host,
    user: config.username,
    port: config.port,
    keyPath: config.keyPath,
    ollamaPort: config.ollamaPort,
    gatewayPort: config.gatewayPort,
  });
});

// POST /api/settings
router.post('/api/settings', (req, res) => {
  const { host, user, port, keyPath, ollamaPort, gatewayPort } = req.body;

  const updated = updateSSHConfig({
    host,
    user,
    port,
    keyPath,
    ollamaPort,
    gatewayPort,
  });

  res.json({
    success: true,
    config: {
      host: updated.host,
      user: updated.username,
      port: updated.port,
      keyPath: updated.keyPath,
      ollamaPort: updated.ollamaPort,
      gatewayPort: updated.gatewayPort,
    },
  });
});

export default router;
