use serde::Serialize;
use windows::Win32::Graphics::Gdi::{
    EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR,
    MONITORINFOEXW,
};
use windows::Win32::Foundation::{LPARAM, RECT};
use windows::core::BOOL;

#[derive(Clone, Serialize)]
pub struct MonitorRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Clone, Serialize)]
pub struct MonitorInfo {
    pub id: String,
    pub name: String,
    pub rect: MonitorRect,
    pub is_primary: bool,
}

struct EnumMonitorsCallbackData {
    monitors: Vec<MonitorInfo>,
}

unsafe extern "system" fn enum_monitors_callback(
    hmonitor: HMONITOR,
    _hdc: HDC,
    _rect: *mut RECT,
    lparam: LPARAM,
) -> BOOL {
    let data = &mut *(lparam.0 as *mut EnumMonitorsCallbackData);
    
    let mut monitor_info = MONITORINFOEXW {
        monitorInfo: Default::default(),
        szDevice: Default::default(),
    };
    monitor_info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
    
    if GetMonitorInfoW(hmonitor, &mut monitor_info as *mut MONITORINFOEXW as *mut _).as_bool() {
        let name = String::from_utf16_lossy(
            &monitor_info.szDevice[..monitor_info.szDevice.iter().position(|&c| c == 0).unwrap_or(monitor_info.szDevice.len())]
        );
        
        let is_primary = (monitor_info.monitorInfo.dwFlags & 1) != 0; // MONITORINFOF_PRIMARY
        
        let rect = monitor_info.monitorInfo.rcMonitor;
        let monitor = MonitorInfo {
            id: format!("monitor_{}", data.monitors.len()),
            name,
            rect: MonitorRect {
                x: rect.left,
                y: rect.top,
                width: rect.right - rect.left,
                height: rect.bottom - rect.top,
            },
            is_primary,
        };
        
        data.monitors.push(monitor);
    }
    
    BOOL(1) // Continue enumeration
}

pub fn enumerate_monitors() -> Result<Vec<MonitorInfo>, String> {
    let mut data = EnumMonitorsCallbackData {
        monitors: Vec::new(),
    };
    
    unsafe {
        if !EnumDisplayMonitors(
            Some(HDC::default()),
            None,
            Some(enum_monitors_callback),
            LPARAM(&mut data as *mut _ as isize),
        ).as_bool() {
            return Err("Failed to enumerate monitors".to_string());
        }
    }
    
    Ok(data.monitors)
}
