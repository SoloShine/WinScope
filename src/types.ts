export interface WindowInfo {
  title: string;
  process_name: string;
  process_id: number;
}

export interface CapturePayload {
  title: string;
  image: string;
}

export interface AppConfig {
  monitored_windows: string[];
  hidden_windows: string[];
  refresh_interval_ms: number;
  always_on_top: boolean;
  window_geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}
