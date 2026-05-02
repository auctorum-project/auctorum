use tokio::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Windows: prevent SSH from spawning a visible console window
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Shell-escape a string by wrapping in single quotes and escaping internal single quotes.
/// This prevents shell injection when passing user-controlled strings to SSH commands.
/// Example: `hello 'world` becomes `'hello '\''world'`
pub fn shell_escape(s: &str) -> String {
    let mut escaped = String::with_capacity(s.len() + 2);
    escaped.push('\'');
    for ch in s.chars() {
        if ch == '\'' {
            // End current single-quoted segment, add an escaped single quote, start new segment
            escaped.push_str("'\\''");
        } else {
            escaped.push(ch);
        }
    }
    escaped.push('\'');
    escaped
}

pub async fn ssh_exec(
    host: &str,
    user: &str,
    port: u16,
    key_path: &Option<String>,
    command: &str,
) -> Result<String, String> {
    let mut cmd = Command::new("ssh");

    // On Windows, prevent each SSH call from opening a visible console window
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    if let Some(key) = key_path {
        if !key.is_empty() {
            cmd.args(["-i", key.as_str()]);
            // When a specific key is provided, only use that identity
            cmd.args(["-o", "IdentitiesOnly=yes"]);
        }
    }

    cmd.args([
        "-p",
        &port.to_string(),
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "ConnectTimeout=10",
        "-o",
        "BatchMode=yes",
        "-o",
        "LogLevel=ERROR",
        &format!("{}@{}", user, host),
        command,
    ]);

    // Log host and a truncated version of the command (avoid leaking sensitive data)
    let truncated = if command.len() > 80 {
        format!("{}...", &command[..80])
    } else {
        command.to_string()
    };
    log::info!("SSH exec -> {}@{}:{} cmd=[{}]", user, host, port, truncated);

    let output = cmd.output().await.map_err(|e| format!("SSH failed: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !stderr.is_empty() {
            Err(format!("SSH error: {}", stderr))
        } else if !stdout.is_empty() {
            // Some commands write to stdout even on failure
            Ok(stdout)
        } else {
            Err(format!(
                "SSH command exited with code: {:?}",
                output.status.code()
            ))
        }
    }
}

/// Helper to get SSH key option from settings
pub fn key_opt(key_path: &str) -> Option<String> {
    if key_path.is_empty() {
        None
    } else {
        Some(key_path.to_string())
    }
}
