import { Router } from 'express';
import { executeSSH, getSSHConfig } from '../ssh.js';

const router = Router();

function getConfigBase() {
  const config = getSSHConfig();
  return `/home/${config.username}/.openclaw`;
}

// GET /api/openclaw/status
router.get('/api/openclaw/status', async (req, res) => {
  try {
    const output = await executeSSH('systemctl is-active openclaw');
    const status = output.trim();
    res.json({
      active: status === 'active',
      status,
    });
  } catch (err) {
    console.error('[openclaw/status] Error:', err.message);
    res.json({
      active: false,
      status: 'unknown',
      error: err.message,
    });
  }
});

// POST /api/openclaw/restart
router.post('/api/openclaw/restart', async (req, res) => {
  try {
    await executeSSH('sudo systemctl restart openclaw');
    res.json({ success: true, message: 'OpenClaw restarted' });
  } catch (err) {
    console.error('[openclaw/restart] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/openclaw/kill
router.post('/api/openclaw/kill', async (req, res) => {
  try {
    await executeSSH('sudo systemctl stop openclaw');
    res.json({ success: true, message: 'OpenClaw stopped' });
  } catch (err) {
    console.error('[openclaw/kill] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/openclaw/permissions
router.get('/api/openclaw/permissions', async (req, res) => {
  const configBase = getConfigBase();
  try {
    const output = await executeSSH(`cat ${configBase}/permissions.json 2>/dev/null || echo '{"permissions":{}}'`);
    const permissions = JSON.parse(output.trim());
    res.json(permissions);
  } catch (err) {
    console.error('[openclaw/permissions] Error:', err.message);
    res.json({ permissions: {}, error: err.message });
  }
});

// POST /api/openclaw/permissions
router.post('/api/openclaw/permissions', async (req, res) => {
  const configBase = getConfigBase();
  try {
    const data = JSON.stringify(req.body).replace(/'/g, "'\\''");
    await executeSSH(`echo '${data}' > ${configBase}/permissions.json`);
    res.json({ success: true });
  } catch (err) {
    console.error('[openclaw/permissions] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/openclaw/config
router.get('/api/openclaw/config', async (req, res) => {
  const configBase = getConfigBase();
  try {
    const output = await executeSSH(`cat ${configBase}/gateway.json 2>/dev/null || echo '{"gateway":{}}'`);
    const config = JSON.parse(output.trim());
    res.json(config);
  } catch (err) {
    console.error('[openclaw/config] Error:', err.message);
    res.json({ gateway: {}, error: err.message });
  }
});

// POST /api/openclaw/config
router.post('/api/openclaw/config', async (req, res) => {
  const configBase = getConfigBase();
  try {
    const data = JSON.stringify(req.body).replace(/'/g, "'\\''");
    await executeSSH(`echo '${data}' > ${configBase}/gateway.json`);
    res.json({ success: true });
  } catch (err) {
    console.error('[openclaw/config] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/openclaw/routines
router.get('/api/openclaw/routines', async (req, res) => {
  const configBase = getConfigBase();
  try {
    const output = await executeSSH(`cat ${configBase}/routines.json 2>/dev/null || echo '{"routines":[]}'`);
    const routines = JSON.parse(output.trim());
    res.json(routines);
  } catch (err) {
    console.error('[openclaw/routines] Error:', err.message);
    res.json({ routines: [], error: err.message });
  }
});

// POST /api/openclaw/routines
router.post('/api/openclaw/routines', async (req, res) => {
  const configBase = getConfigBase();
  try {
    const data = JSON.stringify(req.body).replace(/'/g, "'\\''");
    await executeSSH(`echo '${data}' > ${configBase}/routines.json`);
    res.json({ success: true });
  } catch (err) {
    console.error('[openclaw/routines] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/openclaw/logs
router.get('/api/openclaw/logs', async (req, res) => {
  try {
    const output = await executeSSH('tail -40 /tmp/openclaw/gateway.log 2>/dev/null || echo "No log file found"');
    const lines = output.trim().split('\n');
    res.json({ lines });
  } catch (err) {
    console.error('[openclaw/logs] Error:', err.message);
    res.json({ lines: ['Error fetching logs: ' + err.message] });
  }
});

export default router;
