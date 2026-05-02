export interface WindowInfo {
  title: string;
  process_name: string;
  process_id: number;
  monitor_id: string;
}

export interface CapturePayload {
  title: string;
  image: string;
}

export interface HistoryEntry {
  timestamp: number;
  image: string;
}

export interface MonitorInfo {
  id: string;
  name: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isPrimary: boolean;
}

export interface AppConfig {
  monitored_windows: string[];
  hidden_windows: string[];
  window_tags: Record<string, string[]>;
  refresh_interval_ms: number;
  always_on_top: boolean;
  window_geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  max_history_entries: number;
  enabled_monitors: string[];
  force_capture_minimized: Record<string, boolean>;
}
