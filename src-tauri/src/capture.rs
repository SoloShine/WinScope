use std::io::Cursor;
use std::sync::mpsc::Receiver;

use base64::Engine;
use image::imageops::FilterType;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use windows_capture::capture::{Context, GraphicsCaptureApiHandler};
use windows_capture::frame::Frame;
use windows_capture::graphics_capture_api::InternalCaptureControl;

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
        for chunk in rgba.chunks_exact_mut(4) {
            chunk.swap(0, 2);
        }

        // Create image and downscale
        let img = match image::RgbaImage::from_raw(width, height, rgba) {
            Some(img) => img,
            None => return Ok(()),
        };

        let thumb_height =
            (self.thumbnail_width as f32 * height as f32 / width as f32) as u32;
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
