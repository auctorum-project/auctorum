use serde::{Deserialize, Serialize};
use crate::commands::settings::load_settings;
use crate::ssh;

#[derive(Serialize, Clone)]
pub struct TailscaleStatus {
    pub online: bool,
    pub self_node: Option<TailscaleNode>,
    pub peers: Vec<TailscaleNode>,
    pub tailnet_name: String,
    pub raw_error: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct TailscaleNode {
    pub hostname: String,
    pub dns_name: String,
    pub tailscale_ip: String,
    pub os: String,
    pub online: bool,
    pub relay: String,
    pub rx_bytes: u64,
    pub tx_bytes: u64,
}

#[tauri::command]
pub async fn get_tailscale_status() -> Result<TailscaleStatus, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    let output = ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        "tailscale status --json 2>/dev/null || echo '{\"error\":\"tailscale not available\"}'",
    )
    .await?;

    let json: serde_json::Value =
        serde_json::from_str(output.trim()).map_err(|e| format!("JSON parse error: {}", e))?;

    if json.get("error").is_some() {
        return Ok(TailscaleStatus {
            online: false,
            self_node: None,
            peers: vec![],
            tailnet_name: String::new(),
            raw_error: Some(
                json["error"]
                    .as_str()
                    .unwrap_or("unknown error")
                    .to_string(),
            ),
        });
    }

    let tailnet = json
        .get("MagicDNSSuffix")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Parse self node
    let self_node = json.get("Self").map(|s| parse_peer(s));

    // Parse peers
    let mut peers = Vec::new();
    if let Some(peer_map) = json.get("Peer").and_then(|p| p.as_object()) {
        for (_key, peer) in peer_map {
            peers.push(parse_peer(peer));
        }
    }

    peers.sort_by(|a, b| b.online.cmp(&a.online).then(a.hostname.cmp(&b.hostname)));

    Ok(TailscaleStatus {
        online: true,
        self_node,
        peers,
        tailnet_name: tailnet,
        raw_error: None,
    })
}

fn parse_peer(v: &serde_json::Value) -> TailscaleNode {
    let ips = v
        .get("TailscaleIPs")
        .and_then(|a| a.as_array())
        .and_then(|a| a.first())
        .and_then(|ip| ip.as_str())
        .unwrap_or("")
        .to_string();

    TailscaleNode {
        hostname: v
            .get("HostName")
            .and_then(|h| h.as_str())
            .unwrap_or("unknown")
            .to_string(),
        dns_name: v
            .get("DNSName")
            .and_then(|d| d.as_str())
            .unwrap_or("")
            .to_string(),
        tailscale_ip: ips,
        os: v
            .get("OS")
            .and_then(|o| o.as_str())
            .unwrap_or("unknown")
            .to_string(),
        online: v
            .get("Online")
            .and_then(|o| o.as_bool())
            .unwrap_or(false),
        relay: v
            .get("Relay")
            .and_then(|r| r.as_str())
            .unwrap_or("")
            .to_string(),
        rx_bytes: v
            .get("RxBytes")
            .and_then(|r| r.as_u64())
            .unwrap_or(0),
        tx_bytes: v
            .get("TxBytes")
            .and_then(|t| t.as_u64())
            .unwrap_or(0),
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GatewaySession {
    pub id: String,
    pub connected_at: String,
    pub agent_name: String,
    pub status: String,
}

#[tauri::command]
pub async fn get_gateway_sessions() -> Result<Vec<GatewaySession>, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    let output = ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        &format!(
            "curl -s http://127.0.0.1:{}/api/sessions 2>/dev/null || echo '[]'",
            s.gateway_port
        ),
    )
    .await?;

    let sessions: Vec<GatewaySession> =
        serde_json::from_str(output.trim()).unwrap_or_default();
    Ok(sessions)
}
