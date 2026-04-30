# WinScope

<p align="center">
  <strong>多窗口实时监控工具</strong>
</p>

WinScope 是一款 Windows 桌面应用，可以实时显示所有前台 GUI 窗口的截屏缩略图。适用于游戏挂机监控、多窗口浏览、多任务场景下的全局感知。

## 功能特性

- 实时截取所有前台窗口的画面缩略图
- 可配置的刷新间隔（1秒 / 1.5秒 / 2秒 / 3秒）
- 窗口置顶模式，游戏时也能监控其他窗口
- 窗口筛选面板，按需选择要监控的窗口
- 鼠标悬停放大预览，双击切换到目标窗口
- 监控配置持久化，重启后自动恢复
- 中英文界面切换

## 系统要求

- Windows 10 1903 (Build 18362) 或更高版本
- 支持 DirectX 11 的 GPU

## 安装使用

### 开发模式

```bash
# 安装前端依赖
npm install

# 启动开发环境
npx tauri dev
```

### 生产构建

```bash
npx tauri build
```

构建产物在 `src-tauri/target/release/` 目录下。

## 技术栈

| 组件 | 技术 |
|------|------|
| 应用框架 | Tauri v2 |
| 后端 | Rust |
| 窗口截取 | WinRT Graphics Capture API (`windows-capture` crate) |
| 前端 | React 19 + TypeScript |
| 样式 | TailwindCSS v4 |
| 图标 | Lucide React |

## 项目结构

```
screen-capture/
├── src-tauri/               # Rust 后端
│   ├── src/
│   │   ├── lib.rs           # Tauri 入口、命令、状态管理
│   │   ├── capture.rs       # 窗口截取引擎
│   │   ├── windows.rs       # 窗口枚举
│   │   └── config.rs        # 配置管理
│   └── Cargo.toml
├── src/                     # React 前端
│   ├── App.tsx
│   ├── i18n/                # 国际化
│   ├── components/          # UI 组件
│   └── hooks/               # React Hooks
└── package.json
```

## 使用说明

1. 启动应用后，点击右上角 **设置** 图标打开窗口筛选面板
2. 在面板中点击 **显示器** 图标开始监控某个窗口
3. 缩略图会出现在主界面的网格中
4. 使用工具栏可以：
   - **置顶** — 将应用窗口固定在最前面
   - **暂停/继续** — 控制截图刷新
   - **刷新间隔** — 选择 1秒 / 1.5秒 / 2秒 / 3秒
   - **语言** — 切换中文/英文界面

## 已知限制

- Windows 会在被截取的窗口周围显示黄色边框通知（安全特性，无法关闭）
- 全屏独占模式的 DirectX 游戏可能无法截取（窗口化/无边框窗口模式正常）
- 最小化的窗口可能截取到空画面

## 开源许可

MIT License
