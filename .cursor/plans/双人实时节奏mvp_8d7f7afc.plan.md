---
name: 双人实时节奏MVP
overview: 从零搭建一个最小双人实时节奏 Web 应用：两人进入同一房间、触发简单声音，并由全局节拍统一对齐，优先保证情绪体验与响应感。
todos:
  - id: bootstrap-project
    content: 初始化 Vite 原生前端与 Node ws 后端的最小工程结构
    status: completed
  - id: build-realtime-room
    content: 实现双人房间加入、在线状态与触发事件广播
    status: completed
  - id: add-global-tempo-sync
    content: 实现全局 tempo、拍点量化与 scheduledAt 同步调度
    status: completed
  - id: implement-audio-engine
    content: 使用 Web Audio 实现 2-3 个轻量音色/短循环触发
    status: completed
  - id: design-calm-ui
    content: 完成柔和、低刺激、情绪友好的界面与微交互反馈
    status: completed
  - id: local-test-two-users
    content: 完成双端本地/局域网联调并验证同步与体验标准
    status: completed
isProject: false
---

# 双人实时节奏 MVP 实施计划

## 目标与范围

- 只实现最小闭环：两人连入同房间、触发声音、按全局节拍同步播放。
- 弱化“工具感”，强化“陪伴感”：界面柔和、操作直觉、反馈温和。
- 不做复杂编曲、不做高精度 DAW 级时间校正。

## 技术选型（最轻量）

- 前端：`Vite + Vanilla JS`。
- 后端：`Node.js + ws`（房间与事件转发）。
- 音频：Web Audio API（小体积，避免引入重库）。
- 同步策略：服务器广播 `sessionStartAt`（服务器时间基准）+ 客户端本地节拍调度。

## 目录与核心文件

- [frontend/index.html](/Users/Guanjun/Tempo Love/frontend/index.html)
- [frontend/src/main.js](/Users/Guanjun/Tempo Love/frontend/src/main.js)
- [frontend/src/audio.js](/Users/Guanjun/Tempo Love/frontend/src/audio.js)
- [frontend/src/sync.js](/Users/Guanjun/Tempo Love/frontend/src/sync.js)
- [frontend/src/style.css](/Users/Guanjun/Tempo Love/frontend/src/style.css)
- [server/index.js](/Users/Guanjun/Tempo Love/server/index.js)
- [package.json](/Users/Guanjun/Tempo Love/package.json)

## 最小交互流程

- 用户输入房间号并加入；房间满 2 人后进入“已连接”。
- 任一用户点击 `Pulse` / `Glow` / `Rain` 之类的简单触发按钮。
- 触发事件不立即播放，而是量化到下一拍（或下一小节）时间点。
- 双端在同一拍点播放对应音色/短循环，形成同步“共振”体验。

## 同步与调度设计（MVP 级）

- 服务器维护：`tempo`、`beatIntervalMs`、`sessionStartAt`、房间成员。
- 客户端加入后进行一次时间偏移估计（简单 RTT/2 近似）。
- 客户端点击触发 -> 发送 `trigger`（含事件类型和本地发送时刻）。
- 服务器回广播 `scheduledAt`（下一个量化拍点，基于服务器时钟）。
- 客户端将 `scheduledAt` 映射为本地 AudioContext 时间，提前少量窗口调度。

## 视觉与情绪体验

- 风格关键词：柔和、低对比、圆角、轻微呼吸动画。
- 颜色：暖灰/浅紫/雾蓝等低饱和配色。
- 反馈：按钮触发时有微弱光晕脉冲，避免强刺激。
- 文案语气：轻、暖、非技术化（如“你们正在同一节拍里”）。

## 验收标准（最小可用）

- 两个浏览器窗口加入同一房间后都显示对方在线。
- 任意一端触发后，双方都能在同一拍点附近听到声音。
- 连续触发时节奏整体不乱拍，主观感受“在一起”。
- UI 在无音乐背景下也显得安静、愿意停留。

## 本地验证步骤

- 启动后端 ws 服务与前端 dev server。
- 用两台设备（或同机两个浏览器）连接局域网地址测试。
- 在普通网络抖动下观察：是否仍保持“体感同步”与稳定互动。

