# YOLO 水果忍者

基于 MediaPipe Pose 实时人体骨骼识别、HTML5 Canvas 动态渲染和本地 Node JSON API 实现的体感水果忍者游戏。
这是一个面对社团招新产生的项目，可以在本地电脑运行，让参与的人快速体验 yolo 体感游戏，其中背景音乐为 Gemini 3 Pro 生成。

## 功能特性

- 前臂骨骼切水果：使用 MediaPipe Pose Landmarker 识别左右前臂，按腕部和肘部连线作为切割刀光。
- YOLO 风格界面：为水果、炸弹和特殊道具绘制检测框、置信度标签、扫描网格和命中特效。
- 30 秒挑战模式：支持倒计时、连击、冻结道具、爆炸反馈、背景音乐和音效。
- 本地排行榜：玩家姓名、最高分、上次分数和排行榜会写入本地 JSON 文件。
- 同名合并：排行榜按姓名合并，保留最高分。
- 降级输入：摄像头或模型不可用时，仍可用鼠标或触摸拖动演示核心玩法。

## 技术栈

- 原生 HTML / CSS / JavaScript ES Modules
- HTML5 Canvas 2D 渲染
- MediaPipe Tasks Vision CDN
- Node.js 内置 `http` 静态服务
- 本地 JSON 持久化存储

## 项目结构

```text
.
├── assets/fruit/                # 水果、炸弹、背景等 SVG 资源
├── data/
│   └── fruit-data.example.json  # 可提交的空数据模板
├── fruit-yolo.html              # 游戏页面
├── fruit-yolo.css               # 游戏样式
├── fruit-yolo.js                # 骨骼识别和游戏逻辑
├── game-storage.js              # 浏览器与本地 JSON 存储桥接
├── server.mjs                   # 静态服务和成绩 API
├── index.html                   # 自动跳转到 fruit-yolo.html
├── package.json
└── README.md
```

## 环境要求

- Node.js 18 或更高版本
- 支持摄像头权限的现代浏览器
- 首次加载时需要访问 CDN 资源

游戏会从 CDN 加载 MediaPipe。使用体感交互时，浏览器需要授权摄像头权限。

## 快速开始

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:5173
```

首页会自动跳转到：

```text
http://127.0.0.1:5173/fruit-yolo.html
```

如果 Windows PowerShell 阻止执行 `npm.ps1`，可以直接运行：

```bash
node server.mjs
```

## 本地数据

运行时成绩数据存储在：

```text
data/fruit-data.json
```

该文件可能包含玩家姓名和分数，因此已被 `.gitignore` 忽略。仓库中只保留安全的空模板：

```text
data/fruit-data.example.json
```

本地 API：

```text
GET  /api/fruit-data
POST /api/fruit-data
```

数据结构示例：

```json
{
  "fruitYolo": {
    "best": 0,
    "lastScore": 0,
    "playerName": "",
    "leaderboard": []
  }
}
```

排行榜中姓名规范化后相同的记录会自动合并，并保留最高分。

## 隐私说明

- 摄像头画面由浏览器中的 MediaPipe 处理，本项目不会上传摄像头画面。
- 成绩数据由本地 Node 服务写入本机 JSON 文件。
- 浏览器 `localStorage` 只作为本地 JSON API 不可用时的降级缓存和迁移来源。
- 请不要提交真实的 `data/fruit-data.json`、玩家姓名、浏览器用户数据、API Key 或本地环境文件。

## 开发

项目没有构建步骤。修改 HTML、CSS 或 JS 文件后刷新浏览器即可。

常用检查命令：

```bash
node --check server.mjs
node --check game-storage.js
node --check fruit-yolo.js
```

## 开源前检查

公开发布前建议完成：

- 添加明确的 `LICENSE` 文件。
- 替换或确认第三方媒体资源授权，尤其是 `background.mp3`。
- 确认本地运行数据不会提交到仓库。
- 检查 CDN 使用和 MediaPipe 模型下载是否符合部署环境要求。

## 许可证

当前仓库尚未包含许可证文件。正式开源前请先添加合适的许可证。
