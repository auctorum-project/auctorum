use serde::{Deserialize, Serialize};
use crate::commands::settings::load_settings;
use crate::ssh;

#[derive(Serialize, Clone)]
pub struct OpenClawStatus {
    pub daemon_active: bool,
    pub status_text: String,
}

#[tauri::command]
pub async fn get_openclaw_status() -> Result<OpenClawStatus, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    // Get both is-active check and show status for richer info
    let output = ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        "STATUS=$(systemctl --user is-active openclaw-gateway 2>/dev/null || echo 'inactive'); \
         echo \"$STATUS\"; \
         if [ \"$STATUS\" = 'active' ]; then \
           systemctl --user show openclaw-gateway --property=ActiveEnterTimestamp --no-pager 2>/dev/null | sed 's/ActiveEnterTimestamp=//'; \
         fi",
    )
    .await?;

    let lines: Vec<&str> = output.trim().lines().collect();
    let is_active = lines.first().map(|l| l.trim()) == Some("active");

    let status_text = if is_active {
        if let Some(timestamp) = lines.get(1) {
            let ts = timestamp.trim();
            if ts.is_empty() {
                "active".to_string()
            } else {
                format!("active since {}", ts)
            }
        } else {
            "active".to_string()
        }
    } else {
        lines.first().unwrap_or(&"inactive").trim().to_string()
    };

    Ok(OpenClawStatus {
        daemon_active: is_active,
        status_text,
    })
}

#[tauri::command]
pub async fn openclaw_kill_switch() -> Result<String, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        "systemctl --user stop openclaw-gateway 2>/dev/null; pkill -f openclaw 2>/dev/null; echo 'Kill switch activated'",
    )
    .await
}

#[tauri::command]
pub async fn openclaw_restart() -> Result<String, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        "systemctl --user restart openclaw-gateway 2>/dev/null && echo 'Gateway restarted' || echo 'Restart failed'",
    )
    .await
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AegisPermissions {
    pub bash_enabled: bool,
    pub gmail_enabled: bool,
    pub web_search_enabled: bool,
    pub file_write_enabled: bool,
    pub whatsapp_enabled: bool,
}

#[tauri::command]
pub async fn get_aegis_permissions() -> Result<AegisPermissions, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    let config_path = ssh::shell_escape("~/.openclaw/config/aegis.json");
    let output = ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        &format!("cat {} 2>/dev/null || echo '{{}}'", config_path),
    )
    .await?;

    match serde_json::from_str::<AegisPermissions>(output.trim()) {
        Ok(p) => Ok(p),
        // Fail-secure: default all permissions to disabled when config is missing
        Err(_) => Ok(AegisPermissions {
            bash_enabled: false,
            gmail_enabled: false,
            web_search_enabled: false,
            file_write_enabled: false,
            whatsapp_enabled: false,
        }),
    }
}

#[tauri::command]
pub async fn set_aegis_permissions(permissions: AegisPermissions) -> Result<String, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);
    let json = serde_json::to_string_pretty(&permissions).map_err(|e| e.to_string())?;

    // Use base64 encoding to safely transfer JSON payload, avoiding any shell injection
    let encoded = base64_encode(&json);
    let escaped_b64 = ssh::shell_escape(&encoded);
    let config_dir = ssh::shell_escape("~/.openclaw/config");
    let config_path = ssh::shell_escape("~/.openclaw/config/aegis.json");

    ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        &format!(
            "mkdir -p {} && echo {} | base64 -d > {} && echo 'Permissions updated'",
            config_dir, escaped_b64, config_path
        ),
    )
    .await
}

// ── Gateway Configuration ───────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct GatewayConfig {
    pub model: String,
    pub temperature: f64,
    pub max_tokens: u32,
    pub context_window: u32,
    pub system_prompt: String,
    pub api_port: u16,
    pub log_level: String,
    pub auto_restart: bool,
}

#[tauri::command]
pub async fn get_gateway_config() -> Result<GatewayConfig, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    let config_path = ssh::shell_escape("~/.openclaw/config/gateway.json");
    let output = ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        &format!("cat {} 2>/dev/null || echo '{{}}'", config_path),
    )
    .await?;

    match serde_json::from_str::<GatewayConfig>(output.trim()) {
        Ok(c) => Ok(c),
        Err(_) => Ok(GatewayConfig {
            model: "llama3.2:latest".to_string(),
            temperature: 0.7,
            max_tokens: 2048,
            context_window: 4096,
            system_prompt: String::new(),
            api_port: 18789,
            log_level: "info".to_string(),
            auto_restart: true,
        }),
    }
}

#[tauri::command]
pub async fn set_gateway_config(config: GatewayConfig) -> Result<String, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;

    let encoded = base64_encode(&json);
    let escaped_b64 = ssh::shell_escape(&encoded);
    let config_dir = ssh::shell_escape("~/.openclaw/config");
    let config_path = ssh::shell_escape("~/.openclaw/config/gateway.json");

    ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        &format!(
            "mkdir -p {} && echo {} | base64 -d > {} && echo 'Gateway config saved'",
            config_dir, escaped_b64, config_path
        ),
    )
    .await
}

// ── Routines ────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct Routine {
    pub id: String,
    pub name: String,
    pub schedule: String,
    pub description: String,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Clone)]
struct RoutinesFile {
    routines: Vec<Routine>,
}

#[tauri::command]
pub async fn get_openclaw_routines() -> Result<Vec<Routine>, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    let config_path = ssh::shell_escape("~/.openclaw/config/routines.json");
    let output = ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        &format!("cat {} 2>/dev/null || echo '{{\"routines\":[]}}'", config_path),
    )
    .await?;

    match serde_json::from_str::<RoutinesFile>(output.trim()) {
        Ok(f) => Ok(f.routines),
        Err(_) => Ok(vec![]),
    }
}

#[tauri::command]
pub async fn set_openclaw_routines(routines: Vec<Routine>) -> Result<String, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);
    let file = RoutinesFile { routines };
    let json = serde_json::to_string_pretty(&file).map_err(|e| e.to_string())?;

    let encoded = base64_encode(&json);
    let escaped_b64 = ssh::shell_escape(&encoded);
    let config_dir = ssh::shell_escape("~/.openclaw/config");
    let config_path = ssh::shell_escape("~/.openclaw/config/routines.json");

    ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        &format!(
            "mkdir -p {} && echo {} | base64 -d > {} && echo 'Routines saved'",
            config_dir, escaped_b64, config_path
        ),
    )
    .await
}

// ── Gateway Logs ────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_gateway_logs(lines: Option<u32>) -> Result<String, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);
    let n = lines.unwrap_or(50);

    ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        &format!(
            "tail -n {} ~/.openclaw/logs/gateway.log 2>/dev/null || \
             journalctl --user -u openclaw-gateway --no-pager -n {} 2>/dev/null || \
             echo 'No gateway logs available'",
            n, n
        ),
    )
    .await
}

/// Simple base64 encoder (same pattern as workspace.rs, avoids extra dependency)
fn base64_encode(input: &str) -> String {
    const B64: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity((bytes.len() + 2) / 3 * 4);
    let chunks = bytes.chunks(3);

    for chunk in chunks {
        match chunk.len() {
            3 => {
                out.push(B64[(chunk[0] >> 2) as usize]);
                out.push(B64[((chunk[0] & 0x03) << 4 | chunk[1] >> 4) as usize]);
                out.push(B64[((chunk[1] & 0x0f) << 2 | chunk[2] >> 6) as usize]);
                out.push(B64[(chunk[2] & 0x3f) as usize]);
            }
            2 => {
                out.push(B64[(chunk[0] >> 2) as usize]);
                out.push(B64[((chunk[0] & 0x03) << 4 | chunk[1] >> 4) as usize]);
                out.push(B64[((chunk[1] & 0x0f) << 2) as usize]);
                out.push(b'=');
            }
            1 => {
                out.push(B64[(chunk[0] >> 2) as usize]);
                out.push(B64[((chunk[0] & 0x03) << 4) as usize]);
                out.push(b'=');
                out.push(b'=');
            }
            _ => {}
        }
    }

    String::from_utf8(out).unwrap()
}
