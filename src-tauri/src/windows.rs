use serde::Serialize;
use windows_capture::window::Window;
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFOEXW, MONITOR_DEFAULTTONEAREST};
use windows::Win32::UI::WindowsAndMessaging::IsIconic;

#[derive(Debug, Clone, Serialize)]
pub struct WindowInfo {
    pub title: String,
    pub process_name: String,
    pub process_id: u32,
    pub monitor_id: String,
}

fn get_window_monitor_id(hwnd: *mut std::ffi::c_void) -> Option<String> {
    unsafe {
        let hwnd = HWND(hwnd as *mut _);
        let hmonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        
        let mut monitor_info = MONITORINFOEXW {
            monitorInfo: Default::default(),
            szDevice: Default::default(),
        };
        monitor_info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
        
        if GetMonitorInfoW(hmonitor, &mut monitor_info as *mut MONITORINFOEXW as *mut _).as_bool() {
            let name = String::from_utf16_lossy(
                &monitor_info.szDevice[..monitor_info.szDevice.iter().position(|&c| c == 0).unwrap_or(monitor_info.szDevice.len())]
            );
            Some(name)
        } else {
            None
        }
    }
}

pub fn enumerate_windows() -> Vec<WindowInfo> {
    match Window::enumerate() {
        Ok(windows) => windows
            .into_iter()
            .filter_map(|w| {
                if !w.is_valid() {
                    return None;
                }
                let title = w.title().ok()?;
                if title.is_empty() {
                    return None;
                }
                let process_name = w
                    .process_name()
                    .unwrap_or_else(|_| "unknown".to_string());
                let process_id = w.process_id().unwrap_or(0);
                let hwnd = w.as_raw_hwnd();
                let monitor_id = get_window_monitor_id(hwnd).unwrap_or_else(|| "unknown".to_string());
                Some(WindowInfo {
                    title,
                    process_name,
                    process_id,
                    monitor_id,
                })
            })
            .collect(),
        Err(e) => {
            eprintln!("Failed to enumerate windows: {}", e);
            Vec::new()
        }
    }
}

/// Check if a window is minimized (iconic state).
pub fn is_window_minimized(hwnd: isize) -> bool {
    unsafe {
        let hwnd = HWND(hwnd as *mut _);
        IsIconic(hwnd).as_bool()
    }
}
