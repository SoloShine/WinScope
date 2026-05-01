mod capture;
pub mod config;
mod windows;

use base64::Engine;
use config::AppConfig;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager, State};
use ::windows::Win32::Foundation::HWND;
use ::windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_USE_IMMERSIVE_DARK_MODE};
use ::windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, IsIconic, SetForegroundWindow, ShowWindow, SW_RESTORE,
};
use windows_capture::capture::GraphicsCaptureApiHandler;
use windows_capture::settings::{
    ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
    MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
};
use windows_capture::window::Window;
use windows::WindowInfo;

struct AppState {
    config: Mutex<AppConfig>,
    stop_senders: Mutex<HashMap<String, std::sync::mpsc::Sender<()>>>,
}

fn apply_title_bar_dark(hwnd: HWND, dark: bool) {
    unsafe {
        let value: i32 = if dark { 1 } else { 0 };
        let _ = DwmSetWindowAttribute(
            hwnd,
            DWMWA_USE_IMMERSIVE_DARK_MODE,
            &value as *const _ as *const _,
            std::mem::size_of::<i32>() as u32,
        );
    }
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

#[tauri::command]
fn set_title_bar_theme(app: tauri::AppHandle, dark: bool) -> Result<(), String> {
    let webview_window = app.get_webview_window("main")
        .ok_or("Main window not found")?;
    let hwnd_val = webview_window.hwnd()
        .map_err(|e| format!("Failed to get hwnd: {}", e))?;
    apply_title_bar_dark(HWND(hwnd_val.0 as *mut _), dark);
    Ok(())
}

#[tauri::command]
fn start_capture(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    window_title: String,
) -> Result<(), String> {
    if state
        .stop_senders
        .lock()
        .unwrap()
        .contains_key(&window_title)
    {
        return Err(format!(
            "Capture already running for window: {}",
            window_title
        ));
    }

    let win = Window::from_contains_name(&window_title)
        .map_err(|e| format!("Failed to find window '{}': {}", window_title, e))?;

    let interval_ms = state.config.lock().unwrap().refresh_interval_ms;

    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();
    state
        .stop_senders
        .lock()
        .unwrap()
        .insert(window_title.clone(), stop_tx);

    let title_clone = window_title.clone();
    let app_handle = app.clone();

    let settings = Settings::new(
        win,
        CursorCaptureSettings::WithoutCursor,
        DrawBorderSettings::WithoutBorder,
        SecondaryWindowSettings::Default,
        MinimumUpdateIntervalSettings::Custom(Duration::from_millis(interval_ms)),
        DirtyRegionSettings::Default,
        ColorFormat::Bgra8,
        (app, stop_rx, title_clone.clone(), 480u32),
    );

    std::thread::spawn(move || {
        if let Err(e) = capture::WindowCapture::start(settings) {
            eprintln!("Capture error for '{}': {}", title_clone, e);
        }
        let _ = app_handle.emit("capture-closed", &title_clone);
        // Clean up stale entry so re-capture can succeed
        let state = app_handle.state::<AppState>();
        state.stop_senders.lock().unwrap().remove(&title_clone);
    });

    Ok(())
}

#[tauri::command]
fn stop_capture(state: State<'_, AppState>, window_title: String) -> Result<(), String> {
    match state.stop_senders.lock().unwrap().remove(&window_title) {
        Some(tx) => {
            let _ = tx.send(());
            Ok(())
        }
        None => Err(format!(
            "No active capture for window: {}",
            window_title
        )),
    }
}

#[tauri::command]
fn save_screenshot(path: String, base64_data: String) -> Result<(), String> {
    let data = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    std::fs::write(&path, data).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn capture_full_screenshot(window_title: String) -> Result<String, String> {
    let win = Window::from_contains_name(&window_title)
        .map_err(|e| format!("Failed to find window '{}': {}", window_title, e))?;

    let (tx, rx) = std::sync::mpsc::channel::<Result<Vec<u8>, String>>();

    let settings = Settings::new(
        win,
        CursorCaptureSettings::WithoutCursor,
        DrawBorderSettings::WithoutBorder,
        SecondaryWindowSettings::Default,
        MinimumUpdateIntervalSettings::Default,
        DirtyRegionSettings::Default,
        ColorFormat::Bgra8,
        tx,
    );

    std::thread::spawn(move || {
        if let Err(e) = capture::OneShotCapture::start(settings) {
            eprintln!("One-shot capture error: {}", e);
        }
    });

    let png_data = rx
        .recv_timeout(Duration::from_secs(5))
        .map_err(|_| "Capture timed out".to_string())?
        .map_err(|e| format!("Capture failed: {}", e))?;

    Ok(base64::engine::general_purpose::STANDARD.encode(&png_data))
}

#[tauri::command]
fn bring_to_front(window_title: String) -> Result<(), String> {
    let win = Window::from_contains_name(&window_title)
        .map_err(|e| format!("Failed to find window '{}': {}", window_title, e))?;

    let hwnd = HWND(win.as_raw_hwnd());
    unsafe {
        if IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        }
        let _ = BringWindowToTop(hwnd);
        let result = SetForegroundWindow(hwnd);
        if !result.as_bool() {
            return Err("SetForegroundWindow failed".to_string());
        }
    }

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

            // Apply dark title bar on startup
            if let Some(webview_window) = app.get_webview_window("main") {
                if let Ok(hwnd_val) = webview_window.hwnd() {
                    apply_title_bar_dark(HWND(hwnd_val.0 as *mut _), true);
                }
            }

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_windows,
            get_config,
            update_config,
            set_title_bar_theme,
            start_capture,
            stop_capture,
            bring_to_front,
            save_screenshot,
            capture_full_screenshot
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
