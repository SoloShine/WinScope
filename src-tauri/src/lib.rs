mod capture;
pub mod config;
mod windows;
mod monitors;

use base64::Engine;
use config::AppConfig;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use std::thread;
use tauri::{Emitter, Manager, State};
use tauri::tray::TrayIconBuilder;
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
use monitors::MonitorInfo;

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

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{Menu, MenuItem};

    let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let pause_item = MenuItem::with_id(app, "pause", "暂停截图", true, None::<&str>)?;
    let top_item = MenuItem::with_id(app, "top", "窗口置顶", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show_item, &pause_item, &top_item, &quit_item])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("WinScope")
        .menu(&menu)
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "pause" => {
                    let _ = app.emit("toggle-pause", ());
                }
                "top" => {
                    let _ = app.emit("toggle-always-on-top", ());
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;

    Ok(())
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

    let interval_ms = state.config.lock().unwrap().refresh_interval_ms;

    let (stop_tx, stop_rx) = std::sync::mpsc::channel::<()>();
    state
        .stop_senders
        .lock()
        .unwrap()
        .insert(window_title.clone(), stop_tx);

    let title_clone = window_title.clone();
    let app_handle = app.clone();

    // Hybrid capture strategy: PrintWindow for minimized, GraphicsCaptureApi for normal
    thread::spawn(move || {
        // Track if we moved a minimized window off-screen
        let mut saved_wp: Option<::windows::Win32::UI::WindowsAndMessaging::WINDOWPLACEMENT> = None;
        let mut hwnd_for_restore: Option<isize> = None;

        // Helper closure to restore window if we moved it off-screen
        let restore_window = |wp: &Option<::windows::Win32::UI::WindowsAndMessaging::WINDOWPLACEMENT>,
                               hwnd_val: Option<isize>| {
            if let (Some(wp), Some(hwnd)) = (wp, hwnd_val) {
                capture::PrintWindowCapture::restore_after_capture(hwnd, wp);
            }
        };

        loop {
            // Check stop signal
            if stop_rx.try_recv().is_ok() {
                break;
            }

            // Get window handle
            let win = match Window::from_contains_name(&title_clone) {
                Ok(w) => w,
                Err(_) => break,
            };

            let hwnd = win.as_raw_hwnd() as isize;
            let is_minimized = windows::is_window_minimized(hwnd);

            let result = if is_minimized {
                // Read force_capture from config each iteration (user may toggle at runtime)
                let force_capture = app_handle.state::<AppState>().config.lock().unwrap()
                    .force_capture_minimized
                    .get(&title_clone)
                    .copied()
                    .unwrap_or(false);

                if !force_capture {
                    // Not forced: notify frontend that window is minimized, skip capture
                    let _ = app_handle.emit("capture-minimized", &title_clone);
                    // Wait interval then continue
                    let interval = Duration::from_millis(interval_ms);
                    let start = std::time::Instant::now();
                    while start.elapsed() < interval {
                        if stop_rx.try_recv().is_ok() {
                            let _ = app_handle.emit("capture-closed", &title_clone);
                            let state = app_handle.state::<AppState>();
                            state.stop_senders.lock().unwrap().remove(&title_clone);
                            return;
                        }
                        thread::sleep(Duration::from_millis(50));
                    }
                    continue;
                }

                // Forced: prepare once, then capture
                if saved_wp.is_none() {
                    match capture::PrintWindowCapture::prepare_for_capture(hwnd) {
                        Ok(Some(wp)) => {
                            saved_wp = Some(wp);
                            hwnd_for_restore = Some(hwnd);
                        }
                        Ok(None) => {} // Not actually minimized
                        Err(e) => {
                            eprintln!("Prepare failed for '{}': {}", title_clone, e);
                        }
                    }
                }

                if saved_wp.is_some() {
                    capture::PrintWindowCapture::capture_base64(hwnd, 480)
                } else {
                    Err("Window minimized and prepare failed".to_string())
                }
            } else {
                // Normal window: use GraphicsCaptureApi one-shot
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

                let _ = capture::OneShotCapture::start(settings);

                match rx.recv_timeout(Duration::from_secs(5)) {
                    Ok(Ok(png_data)) => {
                        Ok(base64::Engine::encode(
                            &base64::engine::general_purpose::STANDARD,
                            &png_data,
                        ))
                    }
                    Ok(Err(e)) => Err(e),
                    Err(_) => Err("Capture timed out".to_string()),
                }
            };

            match result {
                Ok(b64) => {
                    let _ = app_handle.emit(
                        "capture-update",
                        capture::CapturePayload {
                            title: title_clone.clone(),
                            image: b64,
                        },
                    );
                }
                Err(e) => {
                    eprintln!("Capture error for '{}': {}", title_clone, e);
                }
            }

            // Wait for interval, but check stop signal periodically
            let interval = Duration::from_millis(interval_ms);
            let start = std::time::Instant::now();
            while start.elapsed() < interval {
                if stop_rx.try_recv().is_ok() {
                    // Signal stop — restore window and exit
                    restore_window(&saved_wp, hwnd_for_restore);
                    let _ = app_handle.emit("capture-closed", &title_clone);
                    let state = app_handle.state::<AppState>();
                    state.stop_senders.lock().unwrap().remove(&title_clone);
                    return;
                }
                thread::sleep(Duration::from_millis(50));
            }
        }

        // Restore window if we moved it off-screen
        restore_window(&saved_wp, hwnd_for_restore);
        let _ = app_handle.emit("capture-closed", &title_clone);
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

    let hwnd = win.as_raw_hwnd() as isize;
    let is_minimized = windows::is_window_minimized(hwnd);

    if is_minimized {
        // Use PrintWindow for minimized windows
        capture::PrintWindowCapture::capture_base64(hwnd, 1920)
    } else {
        // Use GraphicsCaptureApi for normal windows
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

#[tauri::command]
fn minimize_to_tray(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| format!("Failed to hide window: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn get_monitors() -> Result<Vec<MonitorInfo>, String> {
    monitors::enumerate_monitors()
}

#[tauri::command]
fn update_enabled_monitors(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    monitor_ids: Vec<String>,
) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.enabled_monitors = monitor_ids;
    config::save_config(&app, &config)?;
    Ok(())
}

#[tauri::command]
fn toggle_force_capture_minimized(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    window_title: String,
    enabled: bool,
) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    config.force_capture_minimized.insert(window_title, enabled);
    config::save_config(&app, &config)?;
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

            // Setup system tray
            setup_tray(app)?;

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
            capture_full_screenshot,
            minimize_to_tray,
            get_monitors,
            update_enabled_monitors,
            toggle_force_capture_minimized
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
