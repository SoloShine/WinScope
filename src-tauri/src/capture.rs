use std::io::Cursor;
use std::sync::mpsc::Receiver;

use base64::Engine;
use image::imageops::FilterType;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
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
