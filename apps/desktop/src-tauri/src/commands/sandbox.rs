use serde::{Deserialize, Serialize};
use crate::commands::settings::load_settings;

#[derive(Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct ChatResponse {
    pub content: String,
    pub model: String,
    pub total_duration: u64,
    pub eval_count: u64,
}

#[tauri::command]
pub async fn sandbox_chat(
    model: String,
    messages: Vec<ChatMessage>,
) -> Result<ChatResponse, String> {
    let s = load_settings();
    let url = format!("http://{}:{}/api/chat", s.host, s.ollama_port);

    let msgs: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content,
            })
        })
        .collect();

    let body = serde_json::json!({
        "model": model,
        "messages": msgs,
        "stream": false,
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama unreachable at {}: {}", url, e))?;

    if !resp.status().is_success() {
        return Err(format!("Ollama returned status {}", resp.status()));
    }

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let content = json
        .get("message")
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();

    let model_used = json
        .get("model")
        .and_then(|m| m.as_str())
        .unwrap_or(&model)
        .to_string();

    let total_duration = json
        .get("total_duration")
        .and_then(|d| d.as_u64())
        .unwrap_or(0);

    let eval_count = json
        .get("eval_count")
        .and_then(|c| c.as_u64())
        .unwrap_or(0);

    Ok(ChatResponse {
        content,
        model: model_used,
        total_duration,
        eval_count,
    })
}

#[tauri::command]
pub async fn get_available_models() -> Result<Vec<String>, String> {
    let s = load_settings();
    let url = format!("http://{}:{}/api/tags", s.host, s.ollama_port);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Ollama unreachable: {}", e))?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let models: Vec<String> = json
        .get("models")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m.get("name").and_then(|n| n.as_str()).map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Ok(models)
}
