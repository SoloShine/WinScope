use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(default)]
    pub monitored_windows: Vec<String>,
    #[serde(default)]
    pub hidden_windows: Vec<String>,
    #[serde(default = "default_interval")]
    pub refresh_interval_ms: u64,
    #[serde(default)]
    pub always_on_top: bool,
    #[serde(default)]
    pub window_geometry: Option<WindowGeometry>,
}

fn default_interval() -> u64 {
    1500
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            monitored_windows: Vec::new(),
            hidden_windows: Vec::new(),
            refresh_interval_ms: 1500,
            always_on_top: false,
            window_geometry: None,
        }
    }
}

pub fn config_path(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_data_dir().unwrap().join("config.json")
}

pub fn load_config(app: &tauri::AppHandle) -> AppConfig {
    let path = config_path(app);
    match fs::read_to_string(&path) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

pub fn save_config(app: &tauri::AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())
}
