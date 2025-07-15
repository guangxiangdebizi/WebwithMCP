# MCP Web 简化版

基于 test.py 的 MCP 智能助手，前后端分离的 Web 版本。

## 一、目录结构

```
mcp-web/
├─ backend/
│  ├─ main.py          # FastAPI 入口（含 WS & REST）
│  ├─ mcp_agent.py     # 封装 test.py 中 SimpleMCPAgent
│  └─ requirements.txt # 后端依赖
│
└─ frontend/
   ├─ index.html       # 聊天页
   ├─ tools.html       # （可选）工具列表 / 调用日志
   ├─ css/
   │  └─ style.css
   └─ js/
      ├─ ws.js         # WebSocket 封装
      ├─ chat.js       # 聊天逻辑
      └─ tools.js      # （可选）工具页逻辑
```

> 注：前端文件可直接放在 Nginx / GitHub Pages，也可让 FastAPI 静态托管。

---

## 二、后端（FastAPI）

| 路径        | 方法 | 说明 |
|-------------|------|------|
| `/ws/chat`  | WS   | 双向 WebSocket：前端发 user_msg，后端流式返回 ai_msg / tool_start / tool_end |
| `/api/tools`| GET  | 返回当前 MCP 工具列表（JSON）|
| `/api/history` | GET | 返回最近 N 条对话/调用记录（简易内存存储或写文件）|

### 核心流程
```
用户输入 → WebSocket 发送 → FastAPI → SimpleMCPAgent 串行调用
       ← WebSocket 流式推送 ← AI回复 + 工具进度 ← MCP工具执行
```

---

## 三、前端

### 1. `index.html`
```
+--------------------------------------------------+
| 顶栏: 项目名 / 设置                               |
+--------------------------------------------------+
| 聊天窗口                                         |
|  ------------------------------                 |
| | AI / 用户气泡流式刷新           |                |
|  ------------------------------                 |
| ⏳ 工具执行进度 / 结果卡片                        |
+--------------------------------------------------+
| 输入框 [            ]  (发送)                   |
+--------------------------------------------------+
```
核心点：
- `ws.js` 负责自动重连、心跳
- `chat.js` 监听输入 → `ws.send(JSON.stringify({type:'user_msg', content}))`
- 根据 WS 消息类型更新 DOM：
  - `ai_msg` → 追加气泡（逐字显示）
  - `tool_start` → 加载条
  - `tool_end` → 替换为表格 / 文本

### 2. `tools.html`（可选）
- `fetch('/api/tools')` 渲染工具列表
- 调用日志表格（轮询或 WS 推送）

---

## 四、部署

| 组件   | 方案                               |
|--------|------------------------------------|
| 前端   | 纯静态文件→ Nginx / Netlify / S3   |
| 后端   | `uvicorn backend.main:app --host 0.0.0.0 --port 8000` |
| 反向代理 | Nginx：将 `/ws/` 协议升级，静态文件直接回源 |

---

## 五、后续扩展

1. 新工具：后端 `mcp_agent.py` 自动读取，无需前端改动  
2. 历史持久化：写入 `sqlite3` 或本地 JSON  
3. 权限：在 WS 握手做简单 token 校验  
4. UI 美化：可逐步引入 Bootstrap/Tailwind，但保持"零打包"原则

---

## 六、快速启动

1. 安装后端依赖：`pip install -r backend/requirements.txt`
2. 启动后端：`cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000`
3. 打开前端：直接用浏览器打开 `frontend/index.html` 或配置静态服务器 