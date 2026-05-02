import { Router } from 'express';
import { getSSHConfig } from '../ssh.js';

const router = Router();

/**
 * Build the Ollama base URL from the current SSH config.
 * Uses the Tailscale IP directly (no SSH tunnel needed).
 */
function getOllamaURL() {
  const config = getSSHConfig();
  return `http://${config.host}:${config.ollamaPort}`;
}

// GET /api/ollama/models
router.get('/api/ollama/models', async (req, res) => {
  try {
    const response = await fetch(`${getOllamaURL()}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[ollama/models] Error:', err.message);
    res.status(502).json({ error: 'Failed to fetch models from Ollama', detail: err.message });
  }
});

// POST /api/ollama/chat
router.post('/api/ollama/chat', async (req, res) => {
  try {
    const { model, messages, stream } = req.body;

    const response = await fetch(`${getOllamaURL()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: stream !== undefined ? stream : false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama responded with ${response.status}: ${text}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[ollama/chat] Error:', err.message);
    res.status(502).json({ error: 'Failed to chat with Ollama', detail: err.message });
  }
});

// POST /api/ollama/unload
router.post('/api/ollama/unload', async (req, res) => {
  try {
    const { model } = req.body;

    if (!model) {
      return res.status(400).json({ error: 'Model name is required' });
    }

    const response = await fetch(`${getOllamaURL()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        keep_alive: 0,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama responded with ${response.status}: ${text}`);
    }

    const data = await response.json();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[ollama/unload] Error:', err.message);
    res.status(502).json({ error: 'Failed to unload model', detail: err.message });
  }
});

// GET /api/ollama/status
router.get('/api/ollama/status', async (req, res) => {
  const baseURL = getOllamaURL();
  try {
    const [tagsRes, psRes] = await Promise.all([
      fetch(`${baseURL}/api/tags`),
      fetch(`${baseURL}/api/ps`),
    ]);

    if (!tagsRes.ok || !psRes.ok) {
      throw new Error('Ollama not responding');
    }

    const tagsData = await tagsRes.json();
    const psData = await psRes.json();

    res.json({
      online: true,
      models: tagsData.models || [],
      running: psData.models || [],
      endpoint: baseURL,
    });
  } catch (err) {
    console.error('[ollama/status] Error:', err.message);
    res.json({
      online: false,
      models: [],
      running: [],
      endpoint: baseURL,
      error: err.message,
    });
  }
});

export default router;
