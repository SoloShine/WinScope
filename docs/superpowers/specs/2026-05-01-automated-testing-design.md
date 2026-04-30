# 自动化测试设计

## 目标

为 WinScope 建立全栈自动化测试体系，本地日常运行 + tag/发版时 CI 触发，确保代码变更不引入回归。

## 技术选型

### 前端：Playwright headless

在真实 Chromium 中渲染组件、派发真实键盘/鼠标事件，验证 CSS 布局和交互行为。不使用 jsdom 模拟。

**依赖**：
- `@playwright/test`
- Playwright browsers (Chromium)

**测试结构**：
```
tests/
  components/
    toolbar.spec.ts          # 工具栏按钮交互
    window-grid.spec.ts      # 网格布局、滚轮缩放、空状态
    window-card.spec.ts      # 卡片 hover、双击、加载态
    settings-panel.spec.ts   # 筛选面板开关、勾选
  shortcuts.spec.ts          # 全部键盘快捷键
  i18n.spec.ts               # 中英文切换
```

**Tauri API mock 方式**：通过 `window.__TAURI_INTERNALS__` 注入 mock 实现，拦截 `invoke` 和 `listen` 调用。

### 后端：cargo test + tempfile

Rust 内置测试框架，`tempfile` 用于配置文件 I/O 测试。

**测试组织**：
```
src-tauri/src/
  config.rs       → #[cfg(test)] 模块：序列化/反序列化、默认值
  capture.rs      → #[cfg(test)] 模块：BGRA→RGBA 转换、resize
  windows.rs      → #[cfg(test)] 模块：窗口过滤规则
src-tauri/tests/
  config_io.rs    → 集成测试：tempfile 目录下的配置文件读写
```

**不可测部分**：依赖真实 Win32/WinRT API 的窗口枚举和截图，标记 `#[ignore]`，仅本地手动运行。

## CI 流水线

```yaml
# .github/workflows/test.yml
on:
  push:
    tags: ['v*']
  workflow_dispatch:
```

Jobs：
1. **test-frontend**：`npx playwright install --with-deps chromium` → `npx playwright test`
2. **test-backend**：`cargo test`
3. **lint**：`eslint .` + `cargo clippy`
4. **build**：`vite build` + `cargo build`（验证可编译）

## npm scripts

```json
"test": "playwright test",
"test:ui": "playwright test --ui",
"test:headed": "playwright test --headed"
```

## 覆盖率预期

| 模块 | 预期覆盖率 | 说明 |
|------|-----------|------|
| config.rs | ~90% | 全逻辑可测 |
| capture.rs 像素处理 | ~80% | 纯算法 |
| React 组件 | ~75% | 真实浏览器渲染 |
| 键盘快捷键 | ~90% | Playwright 真实按键 |
| Win32 API 调用 | 0% | 标记 ignore |

## 后续演进

若 Playwright 无法覆盖 Tauri bridge 集成场景（如 invoke/listen 真实调用），再引入 tauri-driver 做 E2E 测试补充。
