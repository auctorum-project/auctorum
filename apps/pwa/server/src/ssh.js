import { Client } from 'ssh2';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

// In-memory config that can be updated at runtime
let runtimeConfig = {};

/**
 * Resolve ~ to the user's home directory.
 * On Windows uses USERPROFILE, on Unix uses HOME.
 */
function resolveTilde(filepath) {
  if (!filepath) return filepath;
  if (filepath.startsWith('~')) {
    const home = process.env.USERPROFILE || process.env.HOME || homedir();
    return resolve(home, filepath.slice(2)); // skip ~/ or ~\
  }
  return resolve(filepath);
}

/**
 * Get the current SSH config, merging env vars with any runtime overrides.
 */
export function getSSHConfig() {
  return {
    host: runtimeConfig.host || process.env.SSH_HOST || '100.121.31.99',
    username: runtimeConfig.user || process.env.SSH_USER || 'cocopsn',
    port: parseInt(runtimeConfig.port || process.env.SSH_PORT || '22', 10),
    keyPath: runtimeConfig.keyPath || process.env.SSH_KEY_PATH || '~/.ssh/id_ed25519',
    ollamaPort: parseInt(runtimeConfig.ollamaPort || process.env.OLLAMA_PORT || '11434', 10),
    gatewayPort: parseInt(runtimeConfig.gatewayPort || process.env.GATEWAY_PORT || '8080', 10),
  };
}

/**
 * Update the SSH config in memory (does NOT write to .env file).
 * Allows the frontend Settings page to change connection params at runtime.
 */
export function updateSSHConfig(config) {
  if (config.host !== undefined) runtimeConfig.host = config.host;
  if (config.user !== undefined) runtimeConfig.user = config.user;
  if (config.port !== undefined) runtimeConfig.port = config.port;
  if (config.keyPath !== undefined) runtimeConfig.keyPath = config.keyPath;
  if (config.ollamaPort !== undefined) runtimeConfig.ollamaPort = config.ollamaPort;
  if (config.gatewayPort !== undefined) runtimeConfig.gatewayPort = config.gatewayPort;
  return getSSHConfig();
}

/**
 * Execute a command on the remote server via SSH.
 * Returns stdout as a string.
 */
export function executeSSH(command) {
  return new Promise((resolve, reject) => {
    const config = getSSHConfig();
    const conn = new Client();

    let stdout = '';
    let stderr = '';

    const resolvedKeyPath = resolveTilde(config.keyPath);

    let privateKey;
    try {
      privateKey = readFileSync(resolvedKeyPath);
    } catch (err) {
      reject(new Error(`Failed to read SSH key at ${resolvedKeyPath}: ${err.message}`));
      return;
    }

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }

        stream.on('close', (code) => {
          conn.end();
          if (code !== 0 && stderr.trim()) {
            reject(new Error(`Command exited with code ${code}: ${stderr.trim()}`));
          } else {
            resolve(stdout);
          }
        });

        stream.on('data', (data) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      });
    });

    conn.on('error', (err) => {
      reject(new Error(`SSH connection error: ${err.message}`));
    });

    conn.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      privateKey: privateKey,
      readyTimeout: 10000,
      keepaliveInterval: 5000,
    });
  });
}

export default { executeSSH, getSSHConfig, updateSSHConfig };
