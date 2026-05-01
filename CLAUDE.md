# WinScope - 多窗口实时监控工具

Windows 桌面应用，实时显示所有前台 GUI 窗口的截屏缩略图，用于游戏挂机监控、多窗口浏览等场景。

GitHub: https://github.com/SoloShine/WinScope.git

## 技术栈

- **后端**: Rust + Tauri v2 + `windows-capture` v1.5.0 (WinRT Graphics Capture API)
- **前端**: React 19 + TypeScript + TailwindCSS v4
- **构建**: Vite + Cargo

## 项目结构

```
src-tauri/src/
  lib.rs          # Tauri 入口，命令注册，AppState
  capture.rs      # WindowCapture (GraphicsCaptureApiHandler)
  windows.rs      # 窗口枚举 (windows-capture::Window)
  config.rs       # JSON 配置管理 (app_data_dir/config.json)

src/
  App.tsx                        # 主布局
  i18n/index.tsx                 # 国际化 Provider + useTranslation
  i18n/locales/zh-CN.json        # 中文翻译 (默认)
  i18n/locales/en-US.json        # 英文翻译
  hooks/useCapture.ts            # 核心 Hook (窗口列表、截图、配置)
  components/
    WindowGrid.tsx               # 窗口缩略图网格 (auto-fill + 固定像素宽度)
    WindowCard.tsx               # 单窗口卡片 (aspect-video, hover 预览)
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

## 关键 API (Tauri Commands)

| 命令 | 参数 | 说明 |
|------|------|------|
| `get_windows` | - | 枚举所有可见窗口 |
| `start_capture` | `window_title: String` | 启动窗口截图 (每窗口一个线程) |
| `stop_capture` | `window_title: String` | 停止截图 (通过 mpsc channel 发信号) |
| `bring_to_front` | `window_title: String` | 将窗口恢复并带到前台 |
| `get_config` | - | 读取配置 |
| `update_config` | `config: AppConfig` | 写入配置 |

## 数据流

1. Rust 后端定时枚举窗口 → `get_windows` command
2. 每个被监控窗口独立线程捕获帧 → `capture-update` event → 前端更新缩略图
3. 窗口关闭时 → `capture-closed` event → 前端清理状态
4. 配置变更通过 `update_config` 持久化到 JSON

## API 踩坑记录

### windows-capture v1.5.0
- `as_nopadding_buffer()` **无参数**，返回 `Result<&mut [u8], Error>`
- `Window::as_raw_hwnd()` 返回 `isize`，用 `HWND(value)` 包装
- `GraphicsCaptureApiHandler::start(settings)` **阻塞线程**，必须 spawn
- `Settings::new()` 有 8 个参数，`SecondaryWindowSettings` 和 `DirtyRegionSettings` 用 `Default`

### windows crate
- **必须用 v0.61**（不是 v0.58），因为 windows-capture v1.5.0 依赖 windows 0.61
- 本地 `mod windows;` 会遮蔽外部 crate，用 `::windows::Win32::...` 加前导 `::`
- `SetForegroundWindow` 返回 `BOOL` 不是 `Result`
- 最小化窗口需先 `ShowWindow(SW_RESTORE)` 再 `SetForegroundWindow`

### Tauri v2
- `getCurrentWebviewWindow()` 不是 `getCurrentWindow()`
- 权限名: `allow-inner-size` (非 allow-get-size), `allow-outer-position` (非 allow-get-position)
- `app.emit()` 需要 `use tauri::Emitter`
- `app.path().app_data_dir()` 需要 `use tauri::Manager`
- bundle identifier 不能是 `com.tauri.dev`

## 已知限制

- 全屏独占模式的 DirectX 游戏可能无法截取（窗口化/无边框正常）
- WinRT Capture 会在被截取窗口显示黄色边框通知（Windows 安全特性）
- 窗口匹配用 process_name，同一进程多窗口会全部监控

## 键盘快捷键

| 快捷键 | 功能 | 备注 |
|--------|------|------|
| `Space` | 暂停/恢复截图 | 核心高频操作 |
| `Ctrl+P` | 切换窗口置顶 | 游戏监控常用 |
| `Ctrl+G` | 开关设置面板 | 代替点击齿轮 |
| `Escape` | 关闭设置面板 | 仅面板打开时生效 |
| `Ctrl+I` | 放大缩略图 | I = Increase |
| `Ctrl+D` | 缩小缩略图 | D = Decrease |
| `Ctrl+R` | 重置缩放(260px) | R = Reset |
| `F11` | 切换全屏 | 需要 window:allow-set-fullscreen 权限 |
| `Ctrl+S` | 截图保存 | 全分辨率，保存最后悬停卡片 |
| `Ctrl+F` | (预留) 窗口搜索 | 仅注册按键 |

### 全局热键 (应用不在前台也生效)
| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+M` | 最小化/恢复窗口 |
| `Ctrl+Shift+Space` | 暂停/恢复截图 |

UI 按钮: 左下角全屏切换，右下角缩放(-/重置/+)。Ctrl+滚轮缩放仍可用。

实现: 应用内快捷键通过 `App.tsx` 的 `keydown` 监听（用 ref 避免 stale closure）。全局热键通过 `tauri-plugin-global-shortcut` 注册。

## 功能开发优先级

1. ~~键盘快捷键~~ (已完成)
2. ~~单窗口截图保存~~ — 悬停预览时下载按钮 + Ctrl+S 保存最后悬停卡片
3. ~~自动监控规则~~ — 窗口列表刷新时自动匹配 monitored_windows 开始截取
4. ~~窗口分组/标签~~ — 手动标签(逗号分隔) + 网格标签筛选栏
5. ~~全局热键~~ — Ctrl+Shift+M 最小化/恢复, Ctrl+Shift+Space 暂停/恢复
6. 历史缩略图时间线 — 回溯窗口状态变化
7. 系统托盘 — 最小化到托盘
8. 多显示器过滤 — 只监控指定屏幕

## 设计文档

- [设计规范](docs/superpowers/specs/2026-04-30-window-monitor-design.md)
- [实现计划](docs/superpowers/plans/2026-04-30-window-monitor.md)
- [键盘快捷键设计](docs/superpowers/specs/2026-04-30-keyboard-shortcuts-design.md)
