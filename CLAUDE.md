# WinScope - 多窗口实时监控工具

Windows 桌面应用，实时显示所有前台 GUI 窗口的截屏缩略图，用于游戏挂机监控、多窗口浏览等场景。

## 技术栈

- **后端**: Rust + Tauri v2 + `windows-capture` crate (WinRT Graphics Capture API)
- **前端**: React 19 + TypeScript + TailwindCSS v4
- **构建**: Vite + Cargo

## 项目结构

```
src-tauri/src/
  lib.rs          # Tauri 入口，命令注册，AppState
  capture.rs      # WindowCapture (GraphicsCaptureApiHandler)
  windows.rs      # 窗口枚举 (windows-capture::Window)
  config.rs       # JSON 配置管理

src/
  App.tsx                        # 主布局
  i18n/index.tsx                 # 国际化 Provider + useTranslation
  i18n/locales/zh-CN.json        # 中文翻译 (默认)
  i18n/locales/en-US.json        # 英文翻译
  hooks/useCapture.ts            # 核心 Hook (窗口列表、截图、配置)
  components/
    WindowGrid.tsx               # 窗口缩略图网格
    WindowCard.tsx               # 单窗口卡片
    Toolbar.tsx                  # 工具栏 (置顶/暂停/间隔/语言)
    SettingsPanel.tsx            # 窗口筛选侧栏
  types.ts                       # TypeScript 类型定义
```

## 开发命令

```bash
npm run dev          # 前端开发服务器
npx tauri dev        # 启动完整应用 (前端 + 后端)
npm run build        # 构建前端
cd src-tauri && cargo build  # 构建后端
npx tauri build      # 生产构建 (输出 exe)
```

## 关键 API

- `get_windows` → 枚举所有可见窗口
- `start_capture(window_title)` → 启动窗口截图
- `stop_capture(window_title)` → 停止截图
- `bring_to_front(window_title)` → 将窗口带到前台
- `get_config` / `update_config` → 配置读写

## 注意事项

- 需要 Windows 10 1903+ (Build 18362)
- WinRT Capture API 会显示黄色边框通知 (Windows 安全特性)
- `windows-capture` crate v1.5.0, `windows` crate v0.61
- 每个被监控窗口占一个独立线程 (GraphicsCaptureApiHandler 阻塞线程)
- 默认语言为中文，可在工具栏切换

## 设计文档

- [设计规范](docs/superpowers/specs/2026-04-30-window-monitor-design.md)
- [实现计划](docs/superpowers/plans/2026-04-30-window-monitor.md)
