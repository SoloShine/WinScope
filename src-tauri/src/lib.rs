mod capture;
mod config;
mod windows;

use config::AppConfig;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Manager, State};
use windows::WindowInfo;

struct AppState {
    config: Mutex<AppConfig>,
    stop_senders: Mutex<HashMap<String, std::sync::mpsc::Sender<()>>>,
}

#[tauri::command]
fn get_windows() -> Vec<WindowInfo> {
    windows::enumerate_windows()
}

#[tauri::command]
fn get_config(state: State<'_, AppState>) -> AppConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn update_config(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    config: AppConfig,
) -> Result<(), String> {
    config::save_config(&app, &config)?;
    *state.config.lock().unwrap() = config;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let config = config::load_config(app.handle());
            app.manage(AppState {
                config: Mutex::new(config),
                stop_senders: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_windows, get_config, update_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
