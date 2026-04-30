import { test as base, expect, type Page } from "@playwright/test";

const defaultWindows = [
  { title: "Test Window 1", process_name: "testapp1", process_id: 1001 },
  { title: "Test Window 2", process_name: "testapp2", process_id: 1002 },
];

const defaultConfig = {
  monitored_windows: [] as string[],
  hidden_windows: [] as string[],
  refresh_interval_ms: 1500,
  always_on_top: false,
  window_geometry: null,
};

export interface MockOptions {
  windows?: typeof defaultWindows;
  config?: typeof defaultConfig;
}

async function setupTauriMock(page: Page, options: MockOptions = {}) {
  const windows = options.windows ?? defaultWindows;
  const config = { ...defaultConfig, ...options.config };

  await page.addInitScript(
    ({ windows, config }) => {
      const handlers = new Map<string, Set<(payload: any) => void>>();
      const invokeLog: Array<{ cmd: string; args: any }> = [];
      (window as any).__TAURI_INVOKE_LOG__ = invokeLog;

      function addHandler(event: string, handler: (payload: any) => void) {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event)!.add(handler);
      }

      (window as any).__TAURI_TRIGGER_EVENT__ = (event: string, payload: any) => {
        const set = handlers.get(event);
        if (set) set.forEach((h) => h({ payload }));
      };

      async function mockInvoke(cmd: string, args?: any): Promise<any> {
        invokeLog.push({ cmd, args });
        switch (cmd) {
          case "get_windows":
            return windows;
          case "get_config":
            return config;
          case "update_config":
            Object.assign(config, args.config);
            return null;
          case "start_capture":
            return null;
          case "stop_capture":
            return null;
          case "bring_to_front":
            return null;
          case "set_title_bar_theme":
            return null;
          case "plugin:window|set_always_on_top":
            return null;
          case "plugin:window|set_fullscreen":
            return null;
          default:
            return null;
        }
      }

      async function mockListen(
        event: string,
        handler: (payload: any) => void
      ): Promise<() => void> {
        addHandler(event, handler);
        return () => {
          handlers.get(event)?.delete(handler);
        };
      }

      (window as any).__TAURI_INTERNALS__ = {
        invoke: mockInvoke,
        listen: mockListen,
        emit: async () => {},
        convertFileSrc: (path: string) => `http://localhost/${path}`,
        metadata: {
          currentWebview: { label: "main" },
          currentWindow: { label: "main" },
        },
      };
    },
    { windows, config }
  );
}

export const test = base.extend<{ mockTauri: MockOptions }>({
  mockTauri: [
    async ({ page }, use) => {
      await setupTauriMock(page);
      await use({});
    },
    { auto: true },
  ],
});

export { expect };
