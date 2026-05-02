import { Router } from 'express';
import { getSSHConfig } from '../ssh.js';

const router = Router();

const SIRI_SYSTEM_PROMPT = 'Respond in plain text only. No markdown formatting. No asterisks. No bullet points. Keep responses concise and conversational, suitable for text-to-speech.';

// POST /api/shortcuts/siri
router.post('/api/shortcuts/siri', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).type('text/plain').send('Error: text field is required');
  }

  const config = getSSHConfig();
  const ollamaURL = `http://${config.host}:${config.ollamaPort}`;

  try {
    // First get available models to pick one
    let model = 'llama3.2';
    try {
      const tagsRes = await fetch(`${ollamaURL}/api/tags`);
      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        if (tagsData.models && tagsData.models.length > 0) {
          // Prefer smaller models for Siri (faster response)
          const preferred = ['llama3.2', 'llama3.2:1b', 'llama3.1', 'mistral', 'phi3'];
          const availableNames = tagsData.models.map((m) => m.name);
          const match = preferred.find((p) => availableNames.some((a) => a.startsWith(p)));
          if (match) {
            model = availableNames.find((a) => a.startsWith(match));
          } else {
            model = tagsData.models[0].name;
          }
        }
      }
    } catch (e) {
      // Use default model name
    }

    const response = await fetch(`${ollamaURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SIRI_SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama responded with ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const reply = data.message?.content || 'Sorry, I could not generate a response.';

    res.type('text/plain').send(reply);
  } catch (err) {
    console.error('[siri] Error:', err.message);
    res.status(502).type('text/plain').send('Sorry, I am unable to connect to the AI server right now.');
  }
});

export default router;
