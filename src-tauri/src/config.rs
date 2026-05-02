use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
    #[serde(default)]
    pub window_tags: HashMap<String, Vec<String>>,
    #[serde(default = "default_interval")]
    pub refresh_interval_ms: u64,
    #[serde(default)]
    pub always_on_top: bool,
    #[serde(default)]
    pub window_geometry: Option<WindowGeometry>,
    #[serde(default)]
    pub enabled_monitors: Vec<String>,
    /// Per-window toggle: force capture minimized windows (restores them off-screen)
    #[serde(default)]
    pub force_capture_minimized: HashMap<String, bool>,
}

fn default_interval() -> u64 {
    1500
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            monitored_windows: Vec::new(),
            hidden_windows: Vec::new(),
            window_tags: HashMap::new(),
            refresh_interval_ms: 1500,
            always_on_top: false,
            window_geometry: None,
            enabled_monitors: Vec::new(),
            force_capture_minimized: HashMap::new(),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_values() {
        let config = AppConfig::default();
        assert!(config.monitored_windows.is_empty());
        assert!(config.hidden_windows.is_empty());
        assert_eq!(config.refresh_interval_ms, 1500);
        assert!(!config.always_on_top);
        assert!(config.window_geometry.is_none());
    }

    #[test]
    fn serialize_deserialize_roundtrip() {
        let mut tags = HashMap::new();
        tags.insert("notepad".to_string(), vec!["work".to_string()]);
        let config = AppConfig {
            monitored_windows: vec!["notepad".to_string()],
            hidden_windows: vec!["explorer".to_string()],
            window_tags: tags,
            refresh_interval_ms: 2000,
            always_on_top: true,
            window_geometry: Some(WindowGeometry {
                x: 100,
                y: 200,
                width: 800,
                height: 600,
            }),
            enabled_monitors: vec!["monitor_0".to_string()],
        };
        let json = serde_json::to_string(&config).unwrap();
        let loaded: AppConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(loaded.monitored_windows, config.monitored_windows);
        assert_eq!(loaded.hidden_windows, config.hidden_windows);
        assert_eq!(loaded.refresh_interval_ms, config.refresh_interval_ms);
        assert_eq!(loaded.always_on_top, config.always_on_top);
        assert_eq!(
            loaded.window_geometry.unwrap().width,
            config.window_geometry.unwrap().width
        );
    }

    #[test]
    fn deserialize_empty_json_uses_defaults() {
        let loaded: AppConfig = serde_json::from_str("{}").unwrap();
        assert!(loaded.monitored_windows.is_empty());
        assert_eq!(loaded.refresh_interval_ms, 1500);
        assert!(!loaded.always_on_top);
    }

    #[test]
    fn deserialize_partial_json() {
        let loaded: AppConfig =
            serde_json::from_str(r#"{"always_on_top": true, "refresh_interval_ms": 3000}"#)
                .unwrap();
        assert!(loaded.always_on_top);
        assert_eq!(loaded.refresh_interval_ms, 3000);
        assert!(loaded.monitored_windows.is_empty());
    }

    #[test]
    fn deserialize_invalid_json_falls_back_to_default() {
        let loaded: AppConfig = serde_json::from_str("not json").unwrap_or_default();
        assert_eq!(loaded.refresh_interval_ms, 1500);
    }
}
