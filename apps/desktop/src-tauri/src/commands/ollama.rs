use serde::{Deserialize, Serialize};
use crate::commands::settings::load_settings;

#[derive(Serialize, Deserialize, Clone)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub digest: String,
    pub modified_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OllamaRunningModel {
    pub name: String,
    pub size: u64,
    pub size_vram: u64,
    pub expires_at: String,
}

#[derive(Serialize, Clone)]
pub struct OllamaStatus {
    pub online: bool,
    pub models: Vec<OllamaModel>,
    pub running: Vec<OllamaRunningModel>,
    pub endpoint: String,
}

#[tauri::command]
pub async fn get_ollama_status() -> Result<OllamaStatus, String> {
    let s = load_settings();
    let base = format!("http://{}:{}", s.host, s.ollama_port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;

    let models = match client.get(format!("{}/api/tags", base)).send().await {
        Ok(resp) => {
            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            json.get("models")
                .and_then(|m| m.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| {
                            Some(OllamaModel {
                                name: m.get("name")?.as_str()?.to_string(),
                                size: m.get("size")?.as_u64()?,
                                digest: m
                                    .get("digest")
                                    .and_then(|d| d.as_str())
                                    .unwrap_or("")
                                    .to_string(),
                                modified_at: m
                                    .get("modified_at")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string(),
                            })
                        })
                        .collect()
                })
                .unwrap_or_default()
        }
        Err(_) => {
            return Ok(OllamaStatus {
                online: false,
                models: vec![],
                running: vec![],
                endpoint: base,
            });
        }
    };

    let running = match client.get(format!("{}/api/ps", base)).send().await {
        Ok(resp) => {
            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            json.get("models")
                .and_then(|m| m.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|m| {
                            Some(OllamaRunningModel {
                                name: m.get("name")?.as_str()?.to_string(),
                                size: m.get("size").and_then(|s| s.as_u64()).unwrap_or(0),
                                size_vram: m
                                    .get("size_vram")
                                    .and_then(|s| s.as_u64())
                                    .unwrap_or(0),
                                expires_at: m
                                    .get("expires_at")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("")
                                    .to_string(),
                            })
                        })
                        .collect()
                })
                .unwrap_or_default()
        }
        Err(_) => vec![],
    };

    Ok(OllamaStatus {
        online: true,
        models,
        running,
        endpoint: base,
    })
}

#[tauri::command]
pub async fn ollama_force_unload(model_name: String) -> Result<String, String> {
    let s = load_settings();
    let base = format!("http://{}:{}", s.host, s.ollama_port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let body = serde_json::json!({
        "model": model_name,
        "keep_alive": 0
    });

    client
        .post(format!("{}/api/generate", base))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to send unload signal: {}", e))?;

    // Verify the model was actually unloaded by polling /api/ps
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    match client.get(format!("{}/api/ps", base)).send().await {
        Ok(resp) => {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                let still_loaded = json
                    .get("models")
                    .and_then(|m| m.as_array())
                    .map(|arr| {
                        arr.iter().any(|m| {
                            m.get("name")
                                .and_then(|n| n.as_str())
                                .map(|n| n == model_name)
                                .unwrap_or(false)
                        })
                    })
                    .unwrap_or(false);

                if still_loaded {
                    Ok(format!(
                        "Unload signal sent for {} (model still releasing VRAM)",
                        model_name
                    ))
                } else {
                    Ok(format!("{} unloaded successfully", model_name))
                }
            } else {
                Ok(format!("Unload signal sent for {}", model_name))
            }
        }
        Err(_) => Ok(format!("Unload signal sent for {}", model_name)),
    }
}
