use std::io::Cursor;
use std::sync::mpsc::Receiver;

use base64::Engine;
use image::imageops::FilterType;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits,
    ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS,
    GetWindowDC,
};
use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowPlacement, IsIconic, SetWindowPlacement, SetWindowPos, ShowWindow, HWND_TOP,
    SWP_NOACTIVATE, SWP_NOREDRAW, SWP_NOZORDER, SW_RESTORE, WINDOWPLACEMENT,
};
use windows_capture::capture::{Context, GraphicsCaptureApiHandler};
use windows_capture::frame::Frame;
use windows_capture::graphics_capture_api::InternalCaptureControl;

/// One-shot full-resolution capture for saving screenshots.
pub struct OneShotCapture {
    tx: Option<std::sync::mpsc::Sender<Result<Vec<u8>, String>>>,
}

impl GraphicsCaptureApiHandler for OneShotCapture {
    type Flags = std::sync::mpsc::Sender<Result<Vec<u8>, String>>;
    type Error = Box<dyn std::error::Error + Send + Sync>;

    fn new(ctx: Context<Self::Flags>) -> Result<Self, Self::Error> {
        Ok(Self { tx: Some(ctx.flags) })
    }

    fn on_frame_arrived(
        &mut self,
        frame: &mut Frame,
        capture_control: InternalCaptureControl,
    ) -> Result<(), Self::Error> {
        let width = frame.width();
        let height = frame.height();
        if width == 0 || height == 0 {
            return Ok(());
        }

        let mut buffer = frame.buffer()?;
        let raw = buffer.as_nopadding_buffer()?;
        let mut rgba = raw.to_vec();
        convert_bgra_to_rgba(&mut rgba);

        let result = match image::RgbaImage::from_raw(width, height, rgba) {
            Some(img) => {
                let mut png_data = Vec::new();
                match img.write_to(
                    &mut Cursor::new(&mut png_data),
                    image::ImageFormat::Png,
                ) {
                    Ok(()) => Ok(png_data),
                    Err(e) => Err(format!("PNG encode failed: {}", e)),
                }
            }
            None => Err("Failed to create image".into()),
        };

        if let Some(tx) = self.tx.take() {
            let _ = tx.send(result);
        }
        capture_control.stop();
        Ok(())
    }

    fn on_closed(&mut self) -> Result<(), Self::Error> {
        if let Some(tx) = self.tx.take() {
            let _ = tx.send(Err("Window closed before capture".into()));
        }
        Ok(())
    }
}

#[derive(Clone, Serialize)]
pub struct CapturePayload {
    pub title: String,
    pub image: String,
}

pub struct WindowCapture {
    app: AppHandle,
    stop_rx: Receiver<()>,
    window_title: String,
    thumbnail_width: u32,
}

/// Convert BGRA pixel buffer to RGBA in-place.
pub fn convert_bgra_to_rgba(data: &mut [u8]) {
    for chunk in data.chunks_exact_mut(4) {
        chunk.swap(0, 2);
    }
}

/// Calculate thumbnail height preserving aspect ratio.
pub fn thumbnail_height(src_width: u32, src_height: u32, target_width: u32) -> u32 {
    (target_width as f32 * src_height as f32 / src_width as f32) as u32
}

impl GraphicsCaptureApiHandler for WindowCapture {
    type Flags = (AppHandle, Receiver<()>, String, u32);
    type Error = Box<dyn std::error::Error + Send + Sync>;

    fn new(ctx: Context<Self::Flags>) -> Result<Self, Self::Error> {
        let (app, stop_rx, window_title, thumbnail_width) = ctx.flags;
        Ok(Self {
            app,
            stop_rx,
            window_title,
            thumbnail_width,
        })
    }

    fn on_frame_arrived(
        &mut self,
        frame: &mut Frame,
        capture_control: InternalCaptureControl,
    ) -> Result<(), Self::Error> {
        // Check stop signal (non-blocking)
        if self.stop_rx.try_recv().is_ok() {
            capture_control.stop();
            return Ok(());
        }

        let width = frame.width();
        let height = frame.height();
        if width == 0 || height == 0 {
            return Ok(());
        }

        // Get raw pixel buffer
        let mut buffer = frame.buffer()?;
        let raw = buffer.as_nopadding_buffer()?;

        // Copy pixel data so we can transform it without borrowing issues.
        // The frame uses BGRA format from windows-capture.
        let mut rgba = raw.to_vec();

        // Convert BGRA to RGBA
        convert_bgra_to_rgba(&mut rgba);

        // Create image and downscale
        let img = match image::RgbaImage::from_raw(width, height, rgba) {
            Some(img) => img,
            None => return Ok(()),
        };

        let thumb_height = thumbnail_height(width, height, self.thumbnail_width);
        let thumbnail = image::imageops::resize(
            &img,
            self.thumbnail_width,
            thumb_height,
            FilterType::Triangle,
        );

        // Encode to PNG
        let mut png_data = Vec::new();
        thumbnail.write_to(
            &mut Cursor::new(&mut png_data),
            image::ImageFormat::Png,
        )?;

        // Base64 encode
        let b64 = base64::engine::general_purpose::STANDARD.encode(&png_data);

        // Emit to frontend
        let _ = self.app.emit(
            "capture-update",
            CapturePayload {
                title: self.window_title.clone(),
                image: b64,
            },
        );

        Ok(())
    }

    fn on_closed(&mut self) -> Result<(), Self::Error> {
        Ok(())
    }
}

/// Capture a window using PrintWindow API (works for minimized windows).
/// For minimized windows, call `prepare_for_capture` once before the capture loop,
/// then call `capture` each frame, and `restore_after_capture` when done.
pub struct PrintWindowCapture;

impl PrintWindowCapture {
    /// One-time preparation: if minimized, save placement and move off-screen + restore.
    /// Returns the saved WINDOWPLACEMENT if the window was minimized, None otherwise.
    pub fn prepare_for_capture(hwnd: isize) -> Result<Option<WINDOWPLACEMENT>, String> {
        unsafe {
            let hwnd = HWND(hwnd as *mut _);

            if !IsIconic(hwnd).as_bool() {
                return Ok(None);
            }

            // Save original placement
            let mut wp = WINDOWPLACEMENT::default();
            wp.length = std::mem::size_of::<WINDOWPLACEMENT>() as u32;
            GetWindowPlacement(hwnd, &mut wp)
                .map_err(|e| format!("Failed to get window placement: {}", e))?;

            let rect = wp.rcNormalPosition;
            let w = (rect.right - rect.left) as i32;
            let h = (rect.bottom - rect.top) as i32;

            // Move off-screen and restore (single operation to minimize flicker)
            let _ = SetWindowPos(
                hwnd,
                Some(HWND_TOP),
                -32000, -32000, w, h,
                SWP_NOZORDER | SWP_NOACTIVATE | SWP_NOREDRAW,
            );
            let _ = ShowWindow(hwnd, SW_RESTORE);
            // Brief pause to let the window render
            std::thread::sleep(std::time::Duration::from_millis(100));

            Ok(Some(wp))
        }
    }

    /// Restore a window to its original placement after capture loop ends.
    pub fn restore_after_capture(hwnd: isize, saved_wp: &WINDOWPLACEMENT) {
        unsafe {
            let hwnd = HWND(hwnd as *mut _);
            let _ = SetWindowPlacement(hwnd, saved_wp);
        }
    }

    /// Capture a single frame using PrintWindow.
    /// The window must already be visible (not minimized) — call prepare_for_capture first.
    pub fn capture(hwnd: isize, thumbnail_width: u32) -> Result<Vec<u8>, String> {
        unsafe {
            let hwnd = HWND(hwnd as *mut _);

            // Get real window dimensions
            let mut wp = WINDOWPLACEMENT::default();
            wp.length = std::mem::size_of::<WINDOWPLACEMENT>() as u32;
            GetWindowPlacement(hwnd, &mut wp)
                .map_err(|e| format!("Failed to get window placement: {}", e))?;

            let rect = wp.rcNormalPosition;
            let width = (rect.right - rect.left) as u32;
            let height = (rect.bottom - rect.top) as u32;

            if width == 0 || height == 0 {
                return Err("Window has zero dimensions".to_string());
            }

            let hdc = GetWindowDC(Some(hwnd));
            if hdc.is_invalid() {
                return Err("Failed to get window DC".to_string());
            }

            let mem_dc = CreateCompatibleDC(Some(hdc));
            if mem_dc.is_invalid() {
                let _ = ReleaseDC(Some(hwnd), hdc);
                return Err("Failed to create compatible DC".to_string());
            }

            let bitmap = CreateCompatibleBitmap(hdc, width as i32, height as i32);
            if bitmap.is_invalid() {
                let _ = DeleteDC(mem_dc);
                let _ = ReleaseDC(Some(hwnd), hdc);
                return Err("Failed to create compatible bitmap".to_string());
            }

            let old_bitmap = SelectObject(mem_dc, bitmap.into());

            let result = PrintWindow(hwnd, mem_dc, PRINT_WINDOW_FLAGS(2));
            if !result.as_bool() {
                let _ = PrintWindow(hwnd, mem_dc, PRINT_WINDOW_FLAGS(0));
            }

            let mut bmi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: width as i32,
                    biHeight: -(height as i32),
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: 0,
                    biSizeImage: 0,
                    biXPelsPerMeter: 0,
                    biYPelsPerMeter: 0,
                    biClrUsed: 0,
                    biClrImportant: 0,
                },
                bmiColors: [Default::default(); 1],
            };

            let buffer_size = (width * height * 4) as usize;
            let mut buffer: Vec<u8> = vec![0; buffer_size];

            let _ = GetDIBits(
                mem_dc, bitmap, 0, height,
                Some(buffer.as_mut_ptr() as *mut _),
                &mut bmi, DIB_RGB_COLORS,
            );

            let _ = SelectObject(mem_dc, old_bitmap);
            let _ = DeleteObject(bitmap.into());
            let _ = DeleteDC(mem_dc);
            let _ = ReleaseDC(Some(hwnd), hdc);

            convert_bgra_to_rgba(&mut buffer);

            let img = image::RgbaImage::from_raw(width, height, buffer)
                .ok_or("Failed to create image from buffer")?;

            let thumb_height = thumbnail_height(width, height, thumbnail_width);
            let thumbnail = image::imageops::resize(&img, thumbnail_width, thumb_height, FilterType::Triangle);

            let mut png_data = Vec::new();
            thumbnail
                .write_to(&mut Cursor::new(&mut png_data), image::ImageFormat::Png)
                .map_err(|e| format!("PNG encode failed: {}", e))?;

            Ok(png_data)
        }
    }

    pub fn capture_base64(hwnd: isize, thumbnail_width: u32) -> Result<String, String> {
        let png_data = Self::capture(hwnd, thumbnail_width)?;
        Ok(base64::engine::general_purpose::STANDARD.encode(&png_data))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bgra_to_rgba_single_pixel() {
        let mut data = [10, 20, 30, 255]; // BGRA
        convert_bgra_to_rgba(&mut data);
        assert_eq!(data, [30, 20, 10, 255]); // RGBA
    }

    #[test]
    fn bgra_to_rgba_multiple_pixels() {
        let mut data = [10, 20, 30, 255, 40, 50, 60, 128];
        convert_bgra_to_rgba(&mut data);
        assert_eq!(data, [30, 20, 10, 255, 60, 50, 40, 128]);
    }

    #[test]
    fn bgra_to_rgba_empty_buffer() {
        let mut data: [u8; 0] = [];
        convert_bgra_to_rgba(&mut data);
    }

    #[test]
    fn bgra_to_rgba_incomplete_pixel_ignored() {
        let mut data = [10, 20, 30, 255, 99]; // 5 bytes — last byte ignored
        convert_bgra_to_rgba(&mut data);
        assert_eq!(data, [30, 20, 10, 255, 99]);
    }

    #[test]
    fn thumbnail_height_preserves_aspect_ratio() {
        assert_eq!(thumbnail_height(1920, 1080, 480), 270);
    }

    #[test]
    fn thumbnail_height_square_source() {
        assert_eq!(thumbnail_height(100, 100, 50), 50);
    }

    #[test]
    fn thumbnail_height_tall_source() {
        let h = thumbnail_height(100, 200, 50);
        assert_eq!(h, 100);
    }
}
