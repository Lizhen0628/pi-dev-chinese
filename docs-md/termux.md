# Termux（Android）设置

Pi 可以通过 [Termux](https://termux.dev/) 在 Android 上运行——它是 Android 上的终端模拟器和 Linux 环境。

## 前置条件

1. 从 GitHub 或 F-Droid 安装 [Termux](https://github.com/termux/termux-app#installation)（不要用 Google Play，那个版本已停止维护）
2. 从 GitHub 或 F-Droid 安装 [Termux:API](https://github.com/termux/termux-api#installation)，用于剪贴板等设备集成

## 安装

```bash
# 更新软件包
pkg update && pkg upgrade

# 安装依赖
pkg install nodejs termux-api git

# 安装 pi
npm install -g --ignore-scripts @earendil-works/pi-coding-agent

# 创建配置目录
mkdir -p ~/.pi/agent

# 运行 pi
pi
```

## 剪贴板支持

在 Termux 中运行时，剪贴板操作使用 `termux-clipboard-set` 和 `termux-clipboard-get`，需要安装 Termux:API 应用。

Termux 不支持图片剪贴板（`ctrl+v` 图片粘贴功能不可用）。

## Termux 专用 AGENTS.md 示例

创建 `~/.pi/agent/AGENTS.md`，帮助智能体理解 Termux 环境：

````markdown
# 智能体环境：Android 上的 Termux

## 位置
- **系统**：Android（Termux 终端模拟器）
- **主目录**：`/data/data/com.termux/files/home`
- **前缀**：`/data/data/com.termux/files/usr`
- **共享存储**：`/storage/emulated/0`（Downloads、Documents 等）

## 打开 URL
```bash
termux-open-url "https://example.com"
```

## 打开文件
```bash
termux-open file.pdf          # 用默认应用打开
termux-open --chooser image.jpg      # 自选应用
```

## 剪贴板
```bash
termux-clipboard-set "文本"   # 复制
termux-clipboard-get          # 粘贴
```

## 通知
```bash
termux-notification -t "标题" -c "内容"
```

## 设备信息
```bash
termux-battery-status         # 电池信息
termux-wifi-connectioninfo    # WiFi 信息
termux-telephony-deviceinfo   # 设备信息
```

## 分享
```bash
termux-share -a send file.txt # 分享文件
```

## 其他常用命令
```bash
termux-toast "消息"           # 快速 toast 弹窗
termux-vibrate                # 震动设备
termux-tts-speak "hello"      # 文字转语音
termux-camera-photo out.jpg   # 拍照
```

## 注意
- `termux-*` 命令需要安装 Termux:API 应用
- 用 `pkg install termux-api` 安装命令行工具
- 访问 `/storage/emulated/0` 需要存储权限
````

## 限制

- **无图片剪贴板**：Termux 剪贴板 API 只支持文本
- **存储访问**：访问 `/storage/emulated/0`（Downloads 等）前，运行一次 `termux-setup-storage` 授权

## 故障排查

### 剪贴板不工作

确认两个应用都已安装：
1. Termux（GitHub 或 F-Droid）
2. Termux:API（GitHub 或 F-Droid）

然后安装命令行工具：
```bash
pkg install termux-api
```

### 共享存储权限被拒

运行一次以授予存储权限：
```bash
termux-setup-storage
```

### Node.js 安装问题

npm 失败时，尝试清缓存：
```bash
npm cache clean --force
```
