# 多显示器过滤设计

**日期**: 2026-05-02
**范围**: 按显示器过滤窗口，只监控指定屏幕

## 目标

为 WinScope 添加多显示器过滤功能，允许用户选择只监控特定显示器上的窗口，提高多显示器环境下的监控效率。

## 需求

### 功能需求

1. **显示器检测**
   - 自动检测系统连接的所有显示器
   - 获取显示器信息（名称、分辨率、位置）
   - 识别窗口所在的显示器

2. **显示器选择 UI**
   - 在设置面板中显示显示器列表
   - 用户可选择要监控的显示器
   - 选择持久化到配置文件

3. **窗口过滤**
   - 根据窗口位置自动分配到对应显示器
   - 只显示选定显示器上的窗口
   - 实时更新窗口位置变化

### 非功能需求

- 显示器检测延迟 < 100ms
- 窗口位置更新频率：每 5 秒
- 支持最多 8 个显示器

## 架构

### Win32 API

使用 Win32 API 获取显示器信息和窗口位置：

```rust
// 获取显示器信息
EnumDisplayDevicesW()  // 枚举显示器
GetMonitorInfoW()      // 获取显示器信息

// 获取窗口位置
GetWindowRect()        // 获取窗口矩形
MonitorFromWindow()    // 获取窗口所在的显示器
```

### 数据结构

```rust
// 显示器信息
struct MonitorInfo {
    id: String,           // 显示器 ID
    name: String,         // 显示器名称
    rect: RECT,           // 显示器位置和大小
    is_primary: bool,     // 是否主显示器
}

// 窗口显示器信息
struct WindowMonitorInfo {
    window_title: String,
    monitor_id: String,
}
```

### 前端状态

```typescript
// 显示器信息
interface MonitorInfo {
  id: string;
  name: string;
  rect: { x: number; y: number; width: number; height: number };
  isPrimary: boolean;
}

// 配置更新
interface AppConfig {
  // ... 现有字段
  enabled_monitors: string[];  // 启用的显示器 ID 列表
}
```

### 数据流

1. **显示器检测**
   - 应用启动时枚举所有显示器
   - 返回显示器列表到前端
   - 前端显示显示器选择 UI

2. **窗口过滤**
   - 窗口枚举时获取窗口位置
   - 根据窗口位置确定所属显示器
   - 只显示启用显示器上的窗口

3. **配置更新**
   - 用户选择/取消选择显示器
   - 更新配置文件
   - 重新过滤窗口列表

## UI 设计

### 显示器选择面板

```
┌─────────────────────────────────────────────┐
│  显示器选择                                 │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ 显示器1 │  │ 显示器2 │  │ 显示器3 │    │
│  │ 1920x   │  │ 2560x   │  │ 1920x   │    │
│  │ 1080    │  │ 1440    │  │ 1080    │    │
│  │ 主显示  │  │         │  │         │    │
│  └─────────┘  └─────────┘  └─────────┘    │
│                                             │
│  [✓] 显示器1  [✓] 显示器2  [ ] 显示器3    │
│                                             │
└─────────────────────────────────────────────┘
```

### 窗口卡片标签

- 在窗口卡片上显示显示器标签
- 颜色编码区分不同显示器

## 文件结构

### Rust 后端

- Create: `src-tauri/src/monitors.rs` - 显示器检测和管理
- Modify: `src-tauri/src/lib.rs` - 添加显示器相关命令
- Modify: `src-tauri/src/windows.rs` - 添加窗口显示器信息

### React 前端

- Create: `src/components/MonitorSelector.tsx` - 显示器选择组件
- Modify: `src/components/SettingsPanel.tsx` - 集成显示器选择
- Modify: `src/hooks/useCapture.ts` - 添加显示器过滤逻辑
- Modify: `src/types.ts` - 添加显示器相关类型
- Modify: `src/App.tsx` - 添加显示器状态管理

## 不做的事

- 不支持显示器排列配置
- 不支持显示器分辨率调整
- 不支持显示器镜像检测
- 不支持动态显示器热插拔（需要重启应用）
