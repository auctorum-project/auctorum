import { Router } from 'express';
import { executeSSH, getSSHConfig } from '../ssh.js';

const router = Router();

function getDbPath() {
  const config = getSSHConfig();
  return `/home/${config.username}/.openclaw/memory.db`;
}

// GET /api/memory/info
router.get('/api/memory/info', async (req, res) => {
  const dbPath = getDbPath();
  try {
    const tablesOutput = await executeSSH(`sqlite3 ${dbPath} ".tables"`);
    const tables = tablesOutput.trim().split(/\s+/).filter(Boolean);

    let memoryCount = 0;
    let eventsCount = 0;

    try {
      const memCountOut = await executeSSH(`sqlite3 -json ${dbPath} "SELECT COUNT(*) as c FROM memory"`);
      const memCountArr = JSON.parse(memCountOut.trim());
      memoryCount = memCountArr[0]?.c || 0;
    } catch (e) {
      // table might not exist
    }

    try {
      const evtCountOut = await executeSSH(`sqlite3 -json ${dbPath} "SELECT COUNT(*) as c FROM events"`);
      const evtCountArr = JSON.parse(evtCountOut.trim());
      eventsCount = evtCountArr[0]?.c || 0;
    } catch (e) {
      // table might not exist
    }

    res.json({
      tables,
      memoryCount,
      eventsCount,
      dbPath,
    });
  } catch (err) {
    console.error('[memory/info] Error:', err.message);
    res.json({
      tables: [],
      memoryCount: 0,
      eventsCount: 0,
      dbPath,
      error: err.message,
    });
  }
});

// GET /api/memory/entries
router.get('/api/memory/entries', async (req, res) => {
  const dbPath = getDbPath();
  try {
    const output = await executeSSH(`sqlite3 -json ${dbPath} "SELECT * FROM memory ORDER BY updated DESC LIMIT 200"`);
    const entries = JSON.parse(output.trim() || '[]');
    res.json(entries);
  } catch (err) {
    console.error('[memory/entries] Error:', err.message);
    res.json([]);
  }
});

// GET /api/memory/events
router.get('/api/memory/events', async (req, res) => {
  const dbPath = getDbPath();
  try {
    const output = await executeSSH(`sqlite3 -json ${dbPath} "SELECT * FROM events ORDER BY timestamp DESC LIMIT 100"`);
    const events = JSON.parse(output.trim() || '[]');
    res.json(events);
  } catch (err) {
    console.error('[memory/events] Error:', err.message);
    res.json([]);
  }
});

// POST /api/memory/upsert
router.post('/api/memory/upsert', async (req, res) => {
  const dbPath = getDbPath();
  const { key, value, category, metadata } = req.body;

  if (!key || !value) {
    return res.status(400).json({ error: 'key and value are required' });
  }

  try {
    const escapedKey = key.replace(/'/g, "''");
    const escapedValue = value.replace(/'/g, "''");
    const escapedCategory = (category || 'general').replace(/'/g, "''");
    const escapedMetadata = (metadata || '').replace(/'/g, "''");
    const now = new Date().toISOString();

    const sql = `INSERT OR REPLACE INTO memory (key, value, category, metadata, updated) VALUES ('${escapedKey}', '${escapedValue}', '${escapedCategory}', '${escapedMetadata}', '${now}')`;
    await executeSSH(`sqlite3 ${dbPath} "${sql}"`);
    res.json({ success: true, key });
  } catch (err) {
    console.error('[memory/upsert] Error:', err.message);
    res.status(500).json({ error: 'Failed to upsert memory entry', detail: err.message });
  }
});

// DELETE /api/memory/:key
router.delete('/api/memory/:key', async (req, res) => {
  const dbPath = getDbPath();
  const { key } = req.params;

  try {
    const escapedKey = key.replace(/'/g, "''");
    await executeSSH(`sqlite3 ${dbPath} "DELETE FROM memory WHERE key = '${escapedKey}'"`);
    res.json({ success: true, key });
  } catch (err) {
    console.error('[memory/delete] Error:', err.message);
    res.status(500).json({ error: 'Failed to delete memory entry', detail: err.message });
  }
});

// POST /api/memory/query
router.post('/api/memory/query', async (req, res) => {
  const dbPath = getDbPath();
  const { sql } = req.body;

  if (!sql) {
    return res.status(400).json({ error: 'SQL query is required' });
  }

  try {
    const escapedSql = sql.replace(/"/g, '\\"');
    const output = await executeSSH(`sqlite3 -json ${dbPath} "${escapedSql}"`);
    const results = JSON.parse(output.trim() || '[]');
    res.json(results);
  } catch (err) {
    console.error('[memory/query] Error:', err.message);
    res.status(500).json({ error: 'Failed to execute query', detail: err.message });
  }
});

export default router;
