# 键盘快捷键设计

**日期**: 2026-04-30
**范围**: 应用内快捷键（全局热键留作后续迭代）

## 目标

为 WinScope 添加键盘快捷键，提升日常操作效率。用户无需鼠标即可完成暂停、置顶、缩放、设置面板等高频操作。

## 快捷键映射

| 快捷键 | 功能 | 备注 |
|--------|------|------|
| `Space` | 暂停/恢复截图 | 核心高频操作 |
| `Ctrl+P` | 切换窗口置顶 | 游戏监控场景常用 |
| `Ctrl+G` | 开关设置面板 | 代替点击齿轮图标 |
| `Escape` | 关闭设置面板 | 仅面板打开时生效 |
| `Ctrl+=` | 放大缩略图 | 复用现有滚轮缩放逻辑 |
| `Ctrl+-` | 缩小缩略图 | 同上 |
| `Ctrl+0` | 重置缩放到默认(260px) | 快速恢复默认大小 |
| `F11` | 切换全屏 | 隐藏标题栏，最大化监控区域 |
| `Ctrl+S` | (预留) 截图保存 | 按键注册但不执行操作，后续功能就绪后接入 |
| `Ctrl+F` | (预留) 窗口搜索 | 同上 |

## 架构

### 实现位置

在 `App.tsx` 中用 `useEffect` 注册全局 `keydown` 事件监听器，直接调用 `useCapture` hook 返回的方法和组件内状态。

不创建独立的自定义 hook，原因：
- 快捷键需要访问 `paused`、`config`、`showSettings` 等多处状态
- 这些状态都在 `App.tsx` 作用域内
- 抽成独立 hook 不会减少复杂度，反而增加 prop drilling

### 事件处理

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    // 忽略输入框内的按键（防止搜索框等冲突）
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

    if (e.key === ' ' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setPaused(!paused);
    } else if (e.key === 'p' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      // toggle always-on-top
    }
    // ... 其他快捷键
  };
  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, [paused, config, showSettings, cardWidth]);
```

### 缩放处理

`WindowGrid` 当前将缩放状态 (`cardWidth`) 作为内部 state。为支持键盘缩放和重置，需要：

**方案**: 将 `cardWidth` 和 `setCardWidth` 提升到 `App.tsx`，通过 props 传给 `WindowGrid`。

这样做的好处：
- `App.tsx` 的快捷键处理可以直接修改 `cardWidth`
- `WindowGrid` 的滚轮处理仍然通过 `onWheel` 工作
- 重置缩放只需 `setCardWidth(260)`

### F11 全屏

使用 `getCurrentWebviewWindow().setFullscreen(!isFullscreen)` Tauri API。

需要跟踪全屏状态（可以用 state 或直接查询 webview window 属性）。

### Toolbar 快捷键提示

在 `Toolbar.tsx` 各按钮的 `title` 属性中追加快捷键提示，如 `"置顶 (Ctrl+P)"`。

## 需要修改的文件

1. **`src/App.tsx`** — 添加 keydown 监听，提升 cardWidth 状态
2. **`src/components/WindowGrid.tsx`** — cardWidth 和 resetZoom 改为由 props 控制
3. **`src/components/Toolbar.tsx`** — 按钮添加快捷键提示文案
4. **`src/i18n/locales/zh-CN.json`** — 添加快捷键相关翻译文案
5. **`src/i18n/locales/en-US.json`** — 同上

## 不做的事

- 不实现全局热键（系统级注册），留作后续独立迭代
- 不实现 Ctrl+S 和 Ctrl+F 的具体功能，仅注册按键防止被浏览器默认行为拦截
- 不添加自定义快捷键绑定 UI（固定映射，降低复杂度）
