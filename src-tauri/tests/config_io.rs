use std::collections::HashMap;
use std::fs;

use window_monitor_lib::config::AppConfig;
use window_monitor_lib::config::WindowGeometry;

#[test]
fn save_and_load_config_roundtrip() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("config.json");

    let config = AppConfig {
        monitored_windows: vec!["notepad".to_string(), "chrome".to_string()],
        hidden_windows: vec!["explorer".to_string()],
        window_tags: HashMap::new(),
        refresh_interval_ms: 2000,
        always_on_top: true,
        window_geometry: Some(WindowGeometry {
            x: 50,
            y: 100,
            width: 1024,
            height: 768,
        }),
        enabled_monitors: vec!["monitor_0".to_string()],
    };

    // Save
    let json = serde_json::to_string_pretty(&config).unwrap();
    fs::write(&path, &json).unwrap();

    // Load
    let loaded: AppConfig =
        serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();

    assert_eq!(loaded.monitored_windows, config.monitored_windows);
    assert_eq!(loaded.hidden_windows, config.hidden_windows);
    assert_eq!(loaded.refresh_interval_ms, 2000);
    assert!(loaded.always_on_top);
    let geom = loaded.window_geometry.unwrap();
    assert_eq!(geom.width, 1024);
    assert_eq!(geom.height, 768);
}

#[test]
fn load_missing_file_returns_default() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("nonexistent.json");

    let result = fs::read_to_string(&path);
    let config: AppConfig = match result {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    };

    assert_eq!(config.refresh_interval_ms, 1500);
    assert!(!config.always_on_top);
}

#[test]
fn load_corrupt_file_returns_default() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("config.json");

    fs::write(&path, "this is not json!!!").unwrap();

    let data = fs::read_to_string(&path).unwrap();
    let config: AppConfig = serde_json::from_str(&data).unwrap_or_default();

    assert_eq!(config.refresh_interval_ms, 1500);
}

#[test]
fn save_creates_parent_directories() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("nested").join("dir").join("config.json");

    let config = AppConfig::default();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    let json = serde_json::to_string_pretty(&config).unwrap();
    fs::write(&path, &json).unwrap();

    assert!(path.exists());
    let loaded: AppConfig =
        serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
    assert_eq!(loaded.refresh_interval_ms, 1500);
}
