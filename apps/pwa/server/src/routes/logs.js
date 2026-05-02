import { Router } from 'express';
import { executeSSH, getSSHConfig } from '../ssh.js';

const router = Router();

// GET /api/logs/files
router.get('/api/logs/files', async (req, res) => {
  const config = getSSHConfig();
  const homeDir = `/home/${config.username}`;

  try {
    const output = await executeSSH(
      `ls -la /tmp/openclaw/*.log ${homeDir}/.openclaw/logs/*.log 2>/dev/null || echo "No log files found"`
    );

    const lines = output.trim().split('\n').filter(Boolean);
    const files = [];

    for (const line of lines) {
      if (line.startsWith('total') || line === 'No log files found') continue;

      const parts = line.trim().split(/\s+/);
      if (parts.length >= 9) {
        files.push({
          permissions: parts[0],
          size: parseInt(parts[4], 10) || 0,
          date: `${parts[5]} ${parts[6]} ${parts[7]}`,
          name: parts.slice(8).join(' '),
        });
      }
    }

    res.json(files);
  } catch (err) {
    console.error('[logs/files] Error:', err.message);
    res.json([]);
  }
});

// GET /api/logs/tail
router.get('/api/logs/tail', async (req, res) => {
  const { file, lines } = req.query;

  if (!file) {
    return res.status(400).json({ error: 'file query parameter is required' });
  }

  // Basic path validation to prevent command injection
  const safePath = file.replace(/[;&|`$(){}]/g, '');
  const numLines = parseInt(lines, 10) || 50;
  const clampedLines = Math.min(Math.max(numLines, 1), 1000);

  try {
    const output = await executeSSH(`tail -${clampedLines} ${safePath} 2>/dev/null || echo "File not found or not readable"`);
    const logLines = output.trim().split('\n');
    res.json({ file: safePath, lines: logLines });
  } catch (err) {
    console.error('[logs/tail] Error:', err.message);
    res.status(500).json({ error: 'Failed to read log file', detail: err.message });
  }
});

export default router;
