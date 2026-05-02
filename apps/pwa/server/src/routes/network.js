import { Router } from 'express';
import { executeSSH } from '../ssh.js';

const router = Router();

// GET /api/network/tailscale
router.get('/api/network/tailscale', async (req, res) => {
  try {
    const output = await executeSSH('tailscale status --json');
    const tsData = JSON.parse(output.trim());

    // Extract self node
    const selfNodeKey = tsData.Self?.NodeKey || '';
    const selfNode = {
      id: selfNodeKey,
      hostName: tsData.Self?.HostName || 'unknown',
      dnsName: tsData.Self?.DNSName || '',
      tailscaleIPs: tsData.Self?.TailscaleIPs || [],
      os: tsData.Self?.OS || 'unknown',
      online: tsData.Self?.Online !== false,
      lastSeen: tsData.Self?.LastSeen || '',
      exitNode: tsData.Self?.ExitNode || false,
      exitNodeOption: tsData.Self?.ExitNodeOption || false,
    };

    // Extract peers
    const peers = [];
    if (tsData.Peer) {
      for (const [nodeKey, peer] of Object.entries(tsData.Peer)) {
        peers.push({
          id: nodeKey,
          hostName: peer.HostName || 'unknown',
          dnsName: peer.DNSName || '',
          tailscaleIPs: peer.TailscaleIPs || [],
          os: peer.OS || 'unknown',
          online: peer.Online !== false,
          lastSeen: peer.LastSeen || '',
          exitNode: peer.ExitNode || false,
          exitNodeOption: peer.ExitNodeOption || false,
          rxBytes: peer.RxBytes || 0,
          txBytes: peer.TxBytes || 0,
        });
      }
    }

    // Tailnet name
    const tailnetName = tsData.MagicDNSSuffix || tsData.CurrentTailnet?.Name || 'unknown';

    res.json({
      self: selfNode,
      peers,
      tailnetName,
      backendState: tsData.BackendState || 'Unknown',
      version: tsData.Version || 'unknown',
    });
  } catch (err) {
    console.error('[network/tailscale] Error:', err.message);
    res.json({
      self: {
        id: 'mock',
        hostName: 'mock-host',
        dnsName: 'mock-host.ts.net',
        tailscaleIPs: ['100.0.0.1'],
        os: 'linux',
        online: false,
        lastSeen: new Date().toISOString(),
        exitNode: false,
        exitNodeOption: false,
      },
      peers: [],
      tailnetName: 'mock.ts.net',
      backendState: 'Unavailable',
      version: 'unknown',
      error: err.message,
    });
  }
});

// GET /api/network/sessions
router.get('/api/network/sessions', async (req, res) => {
  try {
    const output = await executeSSH('ss -tnp | grep ESTAB');
    const lines = output.trim().split('\n').filter(Boolean);
    const sessions = lines.map((line) => {
      const parts = line.trim().split(/\s+/);
      return {
        state: parts[0] || 'ESTAB',
        recv: parts[1] || '0',
        send: parts[2] || '0',
        local: parts[3] || '',
        peer: parts[4] || '',
        process: parts[5] || '',
      };
    });
    res.json(sessions);
  } catch (err) {
    console.error('[network/sessions] Error:', err.message);
    res.json([]);
  }
});

export default router;
