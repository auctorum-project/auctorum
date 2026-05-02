use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AppSettings {
    pub host: String,
    pub ssh_user: String,
    pub ssh_port: u16,
    pub ssh_key_path: String,
    pub ollama_port: u16,
    pub gateway_port: u16,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            host: "100.x.x.x".to_string(),
            ssh_user: "cocopsn".to_string(),
            ssh_port: 22,
            ssh_key_path: String::new(),
            ollama_port: 11434,
            gateway_port: 18789,
        }
    }
}

fn get_config_dir() -> String {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_default();
    format!("{}/.auctorum-c2", home)
}

fn get_config_path() -> String {
    format!("{}/config.json", get_config_dir())
}

pub fn load_settings() -> AppSettings {
    let path = get_config_path();
    match std::fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppSettings::default(),
    }
}

#[tauri::command]
pub fn get_settings() -> AppSettings {
    load_settings()
}

#[tauri::command]
pub fn save_settings(settings: AppSettings) -> Result<String, String> {
    let dir = get_config_dir();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = get_config_path();
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok("Settings saved.".to_string())
}

#[tauri::command]
pub async fn test_connection() -> Result<String, String> {
    let s = load_settings();
    let key = crate::ssh::key_opt(&s.ssh_key_path);

    // Measure SSH round-trip latency
    let start = std::time::Instant::now();

    let output = crate::ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        "echo 'OK' && uname -a && hostname",
    )
    .await?;

    let latency_ms = start.elapsed().as_millis();

    // Parse hostname from the output (last non-empty line)
    let lines: Vec<&str> = output.trim().lines().collect();
    let hostname = lines.last().unwrap_or(&"unknown").trim();

    Ok(format!(
        "OK -- {} (latency: {}ms)\n{}",
        hostname,
        latency_ms,
        output.trim()
    ))
}
