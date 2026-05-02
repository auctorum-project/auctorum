use serde::Serialize;
use crate::commands::settings::load_settings;
use crate::ssh;

#[derive(Serialize, Clone)]
pub struct LogFile {
    pub name: String,
    pub path: String,
    pub size: u64,
}

/// Maximum number of log lines that can be requested
const MAX_LOG_LINES: usize = 10000;

/// Validate that a log path is safe to read.
/// Requirements:
/// - Must start with /tmp/openclaw/ OR contain /.openclaw/logs/
/// - Must NOT contain .., backticks, $( , or null bytes
fn validate_log_path(path: &str) -> Result<(), String> {
    if path.contains('\0') {
        return Err("Access denied: path contains null bytes".to_string());
    }
    if path.contains("..") {
        return Err("Access denied: path traversal (..) is not allowed".to_string());
    }
    if path.contains('`') {
        return Err("Access denied: backticks are not allowed in paths".to_string());
    }
    if path.contains("$(") {
        return Err("Access denied: command substitution is not allowed in paths".to_string());
    }

    let is_tmp_openclaw = path.starts_with("/tmp/openclaw/");
    let is_openclaw_logs = path.contains("/.openclaw/logs/");

    if !is_tmp_openclaw && !is_openclaw_logs {
        return Err(
            "Access denied: log path must be under /tmp/openclaw/ or ~/.openclaw/logs/".to_string(),
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn list_log_files() -> Result<Vec<LogFile>, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    let output = ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        r#"for f in /tmp/openclaw/*.log ~/.openclaw/logs/*.log 2>/dev/null; do
            if [ -f "$f" ]; then
                sz=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null || echo 0)
                echo "$f|$(basename "$f")|$sz"
            fi
        done"#,
    )
    .await?;

    let logs: Vec<LogFile> = output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.trim().split('|').collect();
            if parts.len() >= 3 {
                Some(LogFile {
                    path: parts[0].to_string(),
                    name: parts[1].to_string(),
                    size: parts[2].parse().unwrap_or(0),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(logs)
}

#[tauri::command]
pub async fn read_log_tail(path: String, lines: Option<usize>) -> Result<Vec<String>, String> {
    // Validate the log path before executing
    validate_log_path(&path)?;

    // Cap lines at MAX_LOG_LINES
    let n = lines.unwrap_or(500).min(MAX_LOG_LINES);

    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    // Use shell_escape for safe path handling
    let escaped = ssh::shell_escape(&path);

    let output = ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        &format!("tail -n {} {}", n, escaped),
    )
    .await?;

    Ok(output.lines().map(|l| l.to_string()).collect())
}
