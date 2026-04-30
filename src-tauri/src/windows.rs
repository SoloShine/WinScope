use serde::Serialize;
use windows_capture::window::Window;

#[derive(Debug, Clone, Serialize)]
pub struct WindowInfo {
    pub title: String,
    pub process_name: String,
    pub process_id: u32,
}

pub fn enumerate_windows() -> Vec<WindowInfo> {
    match Window::enumerate() {
        Ok(windows) => windows
            .into_iter()
            .filter_map(|w| {
                let title = w.title().ok()?;
                if title.is_empty() {
                    return None;
                }
                let process_name = w
                    .process_name()
                    .unwrap_or_else(|_| "unknown".to_string());
                let process_id = w.process_id().unwrap_or(0);
                Some(WindowInfo {
                    title,
                    process_name,
                    process_id,
                })
            })
            .collect(),
        Err(e) => {
            eprintln!("Failed to enumerate windows: {}", e);
            Vec::new()
        }
    }
}
