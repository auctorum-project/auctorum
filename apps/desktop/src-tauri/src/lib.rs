mod commands;
mod ssh;

use commands::sysinfo_cmd::get_system_metrics;
use commands::ollama::{get_ollama_status, ollama_force_unload};
use commands::openclaw::{
    get_openclaw_status, openclaw_kill_switch, openclaw_restart,
    get_aegis_permissions, set_aegis_permissions,
    get_gateway_config, set_gateway_config,
    get_openclaw_routines, set_openclaw_routines,
    get_gateway_logs,
};
use commands::sqlite_mem::{
    get_memory_db_info, get_memory_entries, get_event_entries,
    upsert_memory, delete_memory, execute_sql_query,
};
use commands::workspace::{get_workspace_tree, read_workspace_file, write_workspace_file};
use commands::logs::{list_log_files, read_log_tail};
use commands::settings::{get_settings, save_settings, test_connection};
use commands::network::{get_tailscale_status, get_gateway_sessions};
use commands::sandbox::{sandbox_chat, get_available_models};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // System metrics
            get_system_metrics,
            // Ollama
            get_ollama_status,
            ollama_force_unload,
            // OpenClaw
            get_openclaw_status,
            openclaw_kill_switch,
            openclaw_restart,
            get_aegis_permissions,
            set_aegis_permissions,
            get_gateway_config,
            set_gateway_config,
            get_openclaw_routines,
            set_openclaw_routines,
            get_gateway_logs,
            // SQLite Memory
            get_memory_db_info,
            get_memory_entries,
            get_event_entries,
            upsert_memory,
            delete_memory,
            execute_sql_query,
            // Workspace
            get_workspace_tree,
            read_workspace_file,
            write_workspace_file,
            // Logs
            list_log_files,
            read_log_tail,
            // Settings
            get_settings,
            save_settings,
            test_connection,
            // Network
            get_tailscale_status,
            get_gateway_sessions,
            // Sandbox
            sandbox_chat,
            get_available_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Auctorum C2");
}
