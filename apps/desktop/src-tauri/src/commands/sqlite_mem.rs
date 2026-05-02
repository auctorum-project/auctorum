use serde::{Deserialize, Serialize};
use crate::commands::settings::load_settings;
use crate::ssh;

#[derive(Serialize, Clone)]
pub struct MemoryEntry {
    pub id: i64,
    pub key: String,
    pub value: String,
    pub updated: String,
    pub source: String,
}

#[derive(Serialize, Clone)]
pub struct EventEntry {
    pub id: i64,
    pub timestamp: String,
    pub event_type: String,
    pub details: String,
}

#[derive(Serialize, Clone)]
pub struct MemoryDbInfo {
    pub tables: Vec<String>,
    pub memory_count: i64,
    pub events_count: i64,
    pub db_size: String,
}

const DB_PATH: &str = "~/.openclaw/data/memory.db";

/// Escape a SQL query string for embedding inside double quotes in a shell command.
/// Replaces `"` with `\"` and `$` with `\$` to prevent shell expansion.
fn escape_for_shell_dquote(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('$', "\\$")
        .replace('`', "\\`")
}

async fn sqlite_query(query: &str) -> Result<String, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);
    let escaped_query = escape_for_shell_dquote(query);
    let cmd = format!(
        "sqlite3 -json {} \"{}\" 2>/dev/null || echo '[]'",
        DB_PATH, escaped_query
    );
    ssh::ssh_exec(&s.host, &s.ssh_user, s.ssh_port, &key, &cmd).await
}

#[tauri::command]
pub async fn get_memory_db_info() -> Result<MemoryDbInfo, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    let output = ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        &format!(
            "if [ -f {} ]; then \
                echo \"TABLES:\"; sqlite3 {} \"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;\"; \
                echo \"MEM_COUNT:\"; sqlite3 {} \"SELECT COUNT(*) FROM memory\" 2>/dev/null || echo 0; \
                echo \"EVT_COUNT:\"; sqlite3 {} \"SELECT COUNT(*) FROM events\" 2>/dev/null || echo 0; \
                echo \"SIZE:\"; du -h {} | cut -f1; \
            else echo 'DB_NOT_FOUND'; fi",
            DB_PATH, DB_PATH, DB_PATH, DB_PATH, DB_PATH
        ),
    )
    .await?;

    if output.contains("DB_NOT_FOUND") {
        return Err("Database not found at ~/.openclaw/data/memory.db".to_string());
    }

    let lines: Vec<&str> = output.lines().collect();
    let mut tables = Vec::new();
    let mut mem_count: i64 = 0;
    let mut evt_count: i64 = 0;
    let mut db_size = String::new();
    let mut section = "";

    for line in lines {
        let l = line.trim();
        if l == "TABLES:" {
            section = "tables";
        } else if l == "MEM_COUNT:" {
            section = "mem";
        } else if l == "EVT_COUNT:" {
            section = "evt";
        } else if l == "SIZE:" {
            section = "size";
        } else if !l.is_empty() {
            match section {
                "tables" => tables.push(l.to_string()),
                "mem" => mem_count = l.parse().unwrap_or(0),
                "evt" => evt_count = l.parse().unwrap_or(0),
                "size" => db_size = l.to_string(),
                _ => {}
            }
        }
    }

    Ok(MemoryDbInfo {
        tables,
        memory_count: mem_count,
        events_count: evt_count,
        db_size,
    })
}

#[tauri::command]
pub async fn get_memory_entries(
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<MemoryEntry>, String> {
    let lim = limit.unwrap_or(200).min(10000);
    let off = offset.unwrap_or(0);

    if off < 0 {
        return Err("Offset must not be negative".to_string());
    }
    if lim < 0 {
        return Err("Limit must not be negative".to_string());
    }

    let output = sqlite_query(&format!(
        "SELECT rowid as id, key, value, updated, source FROM memory ORDER BY updated DESC LIMIT {} OFFSET {}",
        lim, off
    ))
    .await?;

    let rows: Vec<serde_json::Value> =
        serde_json::from_str(output.trim()).unwrap_or_default();

    let entries = rows
        .iter()
        .map(|r| MemoryEntry {
            id: r["id"].as_i64().unwrap_or(0),
            key: r["key"].as_str().unwrap_or("").to_string(),
            value: r["value"].as_str().unwrap_or("").to_string(),
            updated: r["updated"].as_str().unwrap_or("").to_string(),
            source: r["source"].as_str().unwrap_or("").to_string(),
        })
        .collect();

    Ok(entries)
}

#[tauri::command]
pub async fn get_event_entries(limit: Option<i64>) -> Result<Vec<EventEntry>, String> {
    let lim = limit.unwrap_or(100).min(10000);

    if lim < 0 {
        return Err("Limit must not be negative".to_string());
    }

    let output = sqlite_query(&format!(
        "SELECT rowid as id, timestamp, event_type, details FROM events ORDER BY timestamp DESC LIMIT {}",
        lim
    ))
    .await?;

    let rows: Vec<serde_json::Value> =
        serde_json::from_str(output.trim()).unwrap_or_default();

    let entries = rows
        .iter()
        .map(|r| EventEntry {
            id: r["id"].as_i64().unwrap_or(0),
            timestamp: r["timestamp"].as_str().unwrap_or("").to_string(),
            event_type: r["event_type"].as_str().unwrap_or("").to_string(),
            details: r["details"].as_str().unwrap_or("").to_string(),
        })
        .collect();

    Ok(entries)
}

#[derive(Deserialize)]
pub struct UpsertMemory {
    pub key: String,
    pub value: String,
    pub source: String,
}

#[tauri::command]
pub async fn upsert_memory(entry: UpsertMemory) -> Result<String, String> {
    // Escape single quotes for SQLite string literals
    let key = entry.key.replace('\'', "''");
    let value = entry.value.replace('\'', "''");
    let source = entry.source.replace('\'', "''");

    let sql = format!(
        "INSERT INTO memory (key, value, updated, source) VALUES ('{}', '{}', datetime('now'), '{}') \
         ON CONFLICT(key) DO UPDATE SET value='{}', updated=datetime('now'), source='{}'",
        key, value, source, value, source
    );

    // Use shell_escape to wrap the entire sqlite3 command for safe SSH transport
    let inner_cmd = format!("sqlite3 {} \"{}\"", DB_PATH, escape_for_shell_dquote(&sql));
    let s = load_settings();
    let k = ssh::key_opt(&s.ssh_key_path);
    ssh::ssh_exec(&s.host, &s.ssh_user, s.ssh_port, &k, &inner_cmd).await?;

    Ok(format!("Memory '{}' saved.", entry.key))
}

#[tauri::command]
pub async fn delete_memory(key: String) -> Result<String, String> {
    let escaped = key.replace('\'', "''");
    let sql = format!("DELETE FROM memory WHERE key = '{}'", escaped);

    // Use shell_escape to wrap the entire sqlite3 command for safe SSH transport
    let inner_cmd = format!("sqlite3 {} \"{}\"", DB_PATH, escape_for_shell_dquote(&sql));
    let s = load_settings();
    let k = ssh::key_opt(&s.ssh_key_path);
    ssh::ssh_exec(&s.host, &s.ssh_user, s.ssh_port, &k, &inner_cmd).await?;

    Ok(format!("Deleted memory '{}'.", key))
}

/// Dangerous SQL keywords that are not allowed in read-only queries.
const DANGEROUS_KEYWORDS: &[&str] = &[
    "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE",
];

/// Structured SQL result for frontend consumption.
#[derive(Serialize, Clone)]
pub struct SqlResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

/// Execute arbitrary SQL (read-only) for advanced queries.
/// Only SELECT and PRAGMA statements are allowed.
/// Rejects queries with semicolons (prevents chained commands) and dangerous keywords.
#[tauri::command]
pub async fn execute_sql_query(query: String) -> Result<SqlResult, String> {
    let trimmed = query.trim();

    // Must start with SELECT or PRAGMA
    let upper = trimmed.to_uppercase();
    if !upper.starts_with("SELECT") && !upper.starts_with("PRAGMA") {
        return Err("Only SELECT and PRAGMA queries are allowed".to_string());
    }

    // Reject semicolons to prevent chained commands
    if trimmed.contains(';') {
        return Err("Semicolons are not allowed in queries (no chained statements)".to_string());
    }

    // Reject dangerous SQL keywords (case-insensitive)
    for keyword in DANGEROUS_KEYWORDS {
        if contains_sql_keyword(&upper, keyword) {
            return Err(format!(
                "Forbidden SQL keyword '{}' detected. Only SELECT and PRAGMA are allowed.",
                keyword
            ));
        }
    }

    let raw = sqlite_query(trimmed).await?;

    // sqlite3 -json returns an array of objects: [{"col1":"val1","col2":"val2"}, ...]
    // Parse into structured { columns, rows } for the frontend
    let arr: Vec<serde_json::Value> =
        serde_json::from_str(raw.trim()).unwrap_or_default();

    if arr.is_empty() {
        return Ok(SqlResult {
            columns: vec![],
            rows: vec![],
        });
    }

    // Extract column names from the first row's keys (preserving insertion order)
    let columns: Vec<String> = arr[0]
        .as_object()
        .map(|obj| obj.keys().cloned().collect())
        .unwrap_or_default();

    // Extract row values in column order
    let rows: Vec<Vec<String>> = arr
        .iter()
        .map(|row| {
            columns
                .iter()
                .map(|col| match &row[col] {
                    serde_json::Value::Null => "NULL".to_string(),
                    serde_json::Value::String(s) => s.clone(),
                    other => other.to_string(),
                })
                .collect()
        })
        .collect();

    Ok(SqlResult { columns, rows })
}

/// Check if the uppercase query contains a SQL keyword as a standalone token.
/// This avoids false positives on column names like "updated" matching "UPDATE".
fn contains_sql_keyword(upper_query: &str, keyword: &str) -> bool {
    let query_bytes = upper_query.as_bytes();
    let kw_bytes = keyword.as_bytes();
    let kw_len = kw_bytes.len();

    if upper_query.len() < kw_len {
        return false;
    }

    for i in 0..=(query_bytes.len() - kw_len) {
        if &query_bytes[i..i + kw_len] == kw_bytes {
            // Check that the character before (if any) is not alphanumeric/underscore
            let before_ok = if i == 0 {
                true
            } else {
                let c = query_bytes[i - 1];
                !c.is_ascii_alphanumeric() && c != b'_'
            };
            // Check that the character after (if any) is not alphanumeric/underscore
            let after_ok = if i + kw_len >= query_bytes.len() {
                true
            } else {
                let c = query_bytes[i + kw_len];
                !c.is_ascii_alphanumeric() && c != b'_'
            };
            if before_ok && after_ok {
                return true;
            }
        }
    }

    false
}
