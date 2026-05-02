import { Router } from 'express';
import { executeSSH, getSSHConfig } from '../ssh.js';

const router = Router();

function getWorkspacePath() {
  const config = getSSHConfig();
  return `/home/${config.username}/.openclaw/workspace`;
}

/**
 * Build a tree structure from a flat list of file paths.
 */
function buildTree(paths, basePath) {
  const root = { name: 'workspace', path: basePath, type: 'directory', children: [] };
  const nodeMap = { [basePath]: root };

  // Sort paths so directories come before their contents
  const sorted = paths.sort();

  for (const fullPath of sorted) {
    if (!fullPath || fullPath === basePath) continue;

    const relativePath = fullPath.startsWith(basePath)
      ? fullPath.slice(basePath.length + 1)
      : fullPath;

    if (!relativePath) continue;

    const parts = relativePath.split('/').filter(Boolean);
    let currentPath = basePath;
    let parentNode = root;

    for (let i = 0; i < parts.length; i++) {
      currentPath += '/' + parts[i];
      const isLast = i === parts.length - 1;

      if (!nodeMap[currentPath]) {
        const node = {
          name: parts[i],
          path: currentPath,
          type: isLast ? 'file' : 'directory',
          children: isLast ? undefined : [],
        };
        nodeMap[currentPath] = node;
        if (parentNode.children) {
          parentNode.children.push(node);
        }
      }

      parentNode = nodeMap[currentPath];
    }
  }

  return root;
}

// GET /api/editor/tree
router.get('/api/editor/tree', async (req, res) => {
  const workspacePath = getWorkspacePath();
  try {
    const output = await executeSSH(
      `find ${workspacePath} -type f -o -type d 2>/dev/null | sort`
    );

    const paths = output.trim().split('\n').filter(Boolean);
    const tree = buildTree(paths, workspacePath);

    res.json(tree);
  } catch (err) {
    console.error('[editor/tree] Error:', err.message);
    res.json({
      name: 'workspace',
      path: workspacePath,
      type: 'directory',
      children: [],
      error: err.message,
    });
  }
});

// GET /api/editor/file
router.get('/api/editor/file', async (req, res) => {
  const { path: filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: 'path query parameter is required' });
  }

  // Basic path validation
  const safePath = filePath.replace(/[;&|`$(){}]/g, '');

  try {
    const output = await executeSSH(`cat "${safePath}" 2>/dev/null`);
    res.json({
      path: safePath,
      content: output,
    });
  } catch (err) {
    console.error('[editor/file] Error:', err.message);
    res.status(500).json({ error: 'Failed to read file', detail: err.message });
  }
});

// POST /api/editor/file
router.post('/api/editor/file', async (req, res) => {
  const { path: filePath, content } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'path is required' });
  }

  if (content === undefined || content === null) {
    return res.status(400).json({ error: 'content is required' });
  }

  // Basic path validation
  const safePath = filePath.replace(/[;&|`$(){}]/g, '');

  try {
    // Ensure parent directory exists, then write file using heredoc
    const escapedContent = content.replace(/\\/g, '\\\\').replace(/'/g, "'\\''");
    await executeSSH(`mkdir -p "$(dirname "${safePath}")" && cat > "${safePath}" << 'AUCTORUM_EOF'\n${content}\nAUCTORUM_EOF`);
    res.json({ success: true, path: safePath });
  } catch (err) {
    console.error('[editor/file] Error:', err.message);
    res.status(500).json({ error: 'Failed to write file', detail: err.message });
  }
});

export default router;
