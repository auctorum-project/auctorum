use serde::{Deserialize, Serialize};
use crate::commands::settings::load_settings;
use crate::ssh;

#[derive(Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
    pub size: u64,
}

/// Maximum content size for file writes (1 MB)
const MAX_CONTENT_SIZE: usize = 1_048_576;

/// Validate that a path is safe for workspace operations.
/// Requirements:
/// - Must start with /home/
/// - Must contain /.openclaw/workspace/
/// - Must NOT contain .., backticks, $( , or null bytes
fn validate_workspace_path(path: &str) -> Result<(), String> {
    if path.contains('\0') {
        return Err("Access denied: path contains null bytes".to_string());
    }
    if !path.starts_with("/home/") {
        return Err("Access denied: path must start with /home/".to_string());
    }
    if !path.contains("/.openclaw/workspace/") {
        return Err("Access denied: path must be inside /.openclaw/workspace/".to_string());
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
    Ok(())
}

#[tauri::command]
pub async fn get_workspace_tree() -> Result<FileNode, String> {
    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    let output = ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        r#"python3 -c "
import os,json
root=os.path.expanduser('~/.openclaw/workspace')
def tree(p,d=0):
    n=os.path.basename(p) or 'workspace'
    if os.path.isdir(p):
        ch=[]
        if d<5:
            try:
                for e in sorted(os.listdir(p)):
                    fp=os.path.join(p,e)
                    ch.append(tree(fp,d+1))
                ch.sort(key=lambda x: (not x['is_dir'], x['name']))
            except: pass
        return {'name':n,'path':p,'is_dir':True,'children':ch,'size':0}
    else:
        sz=os.path.getsize(p) if os.path.exists(p) else 0
        return {'name':n,'path':p,'is_dir':False,'children':None,'size':sz}
if os.path.exists(root):
    print(json.dumps(tree(root)))
else:
    print(json.dumps({'name':'workspace','path':root,'is_dir':True,'children':[],'size':0}))
"
"#,
    )
    .await?;

    serde_json::from_str(output.trim())
        .map_err(|e| format!("Failed to parse workspace tree: {}", e))
}

#[tauri::command]
pub async fn read_workspace_file(path: String) -> Result<String, String> {
    // Security: strict path validation
    validate_workspace_path(&path)?;

    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    let escaped_path = ssh::shell_escape(&path);
    ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        &format!("cat {}", escaped_path),
    )
    .await
}

#[tauri::command]
pub async fn write_workspace_file(path: String, content: String) -> Result<String, String> {
    // Security: strict path validation
    validate_workspace_path(&path)?;

    // Enforce 1MB size limit
    if content.len() > MAX_CONTENT_SIZE {
        return Err(format!(
            "Content too large: {} bytes exceeds maximum of {} bytes (1 MB)",
            content.len(),
            MAX_CONTENT_SIZE
        ));
    }

    let s = load_settings();
    let key = ssh::key_opt(&s.ssh_key_path);

    // Use base64 encoding to safely transfer content
    let encoded = base64_encode(&content);
    let escaped_path = ssh::shell_escape(&path);
    // Defense in depth: shell_escape the base64 content too
    let escaped_b64 = ssh::shell_escape(&encoded);

    ssh::ssh_exec(
        &s.host,
        &s.ssh_user,
        s.ssh_port,
        &key,
        &format!(
            "mkdir -p \"$(dirname {})\" && echo {} | base64 -d > {} && echo 'File saved'",
            escaped_path, escaped_b64, escaped_path
        ),
    )
    .await
}

fn base64_encode(input: &str) -> String {
    use std::io::Write;
    let mut buf = Vec::new();
    {
        let mut encoder = Base64Encoder::new(&mut buf);
        encoder.write_all(input.as_bytes()).unwrap();
        encoder.finish().unwrap();
    }
    String::from_utf8(buf).unwrap()
}

// Simple base64 encoder (avoids extra dependency)
struct Base64Encoder<'a> {
    out: &'a mut Vec<u8>,
    buf: [u8; 3],
    buf_len: usize,
}

const B64: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

impl<'a> Base64Encoder<'a> {
    fn new(out: &'a mut Vec<u8>) -> Self {
        Self {
            out,
            buf: [0; 3],
            buf_len: 0,
        }
    }

    fn flush_buf(&mut self) {
        if self.buf_len == 0 {
            return;
        }
        let b = self.buf;
        match self.buf_len {
            3 => {
                self.out.push(B64[(b[0] >> 2) as usize]);
                self.out
                    .push(B64[((b[0] & 0x03) << 4 | b[1] >> 4) as usize]);
                self.out
                    .push(B64[((b[1] & 0x0f) << 2 | b[2] >> 6) as usize]);
                self.out.push(B64[(b[2] & 0x3f) as usize]);
            }
            2 => {
                self.out.push(B64[(b[0] >> 2) as usize]);
                self.out
                    .push(B64[((b[0] & 0x03) << 4 | b[1] >> 4) as usize]);
                self.out.push(B64[((b[1] & 0x0f) << 2) as usize]);
                self.out.push(b'=');
            }
            1 => {
                self.out.push(B64[(b[0] >> 2) as usize]);
                self.out.push(B64[((b[0] & 0x03) << 4) as usize]);
                self.out.push(b'=');
                self.out.push(b'=');
            }
            _ => {}
        }
        self.buf_len = 0;
        self.buf = [0; 3];
    }

    fn finish(mut self) -> std::io::Result<()> {
        self.flush_buf();
        Ok(())
    }
}

impl<'a> std::io::Write for Base64Encoder<'a> {
    fn write(&mut self, data: &[u8]) -> std::io::Result<usize> {
        for &byte in data {
            self.buf[self.buf_len] = byte;
            self.buf_len += 1;
            if self.buf_len == 3 {
                self.flush_buf();
            }
        }
        Ok(data.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}
