# 🤖 MCP Web 智能助手 (WebwithMCP)

一个基于 **MCP (Model Context Protocol)** 的智能对话助手Web应用，支持实时聊天、工具调用和对话历史管理。

> 📖 **多语言文档**: [English](README_EN.md) | [中文](README.md)

[![GitHub Stars](https://img.shields.io/github/stars/guangxiangdebizi/WebwithMCP?style=social)](https://github.com/guangxiangdebizi/WebwithMCP)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.8+-blue.svg)](https://python.org)

## ✨ 项目特点

- 🚀 **前后端分离**: FastAPI后端 + 原生前端，架构清晰
- 💬 **实时通信**: WebSocket支持流式对话和工具调用进度
- 🔧 **MCP工具集成**: 支持多种MCP工具扩展AI能力  
- 📊 **对话历史**: SQLite数据库存储完整对话记录
- 🎨 **现代UI**: 响应式设计，支持Markdown渲染
- ⚙️ **灵活配置**: 支持多环境部署配置

## 🏗️ 技术架构

```
┌─────────────┐    WebSocket    ┌──────────────┐    MCP Protocol    ┌─────────────┐
│   前端界面   │ ←────────────→ │  FastAPI后端  │ ←───────────────→ │  MCP工具服务  │
│  (HTML/JS)  │    REST API     │   (Python)   │                   │ (金融数据等)  │
└─────────────┘                └──────────────┘                   └─────────────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │ SQLite数据库  │
                                │  (对话历史)   │
                                └──────────────┘
```

## 📋 环境要求

- **Python**: 3.8+
- **Node.js**: 可选（仅用于前端开发）
- **浏览器**: 支持WebSocket的现代浏览器

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/guangxiangdebizi/WebwithMCP.git
cd WebwithMCP
```

### 2. 后端配置

#### 安装Python依赖

```bash
cd backend
pip install -r requirements.txt
```

#### 配置API密钥

编辑 `backend/mcp_agent.py` 文件中的 `MODEL_CONFIG` 部分：

```python
MODEL_CONFIG = {
    "api_key": "your-api-key-here",        # 替换为您的API密钥
    "base_url": "https://api.deepseek.com/v1",  # API服务地址
    "model_name": "deepseek-chat",              # 模型名称
    "temperature": 0.2,
    "timeout": 60
}
```

#### 配置MCP服务器 (可选)

编辑 `backend/mcp.json` 文件添加您的MCP工具服务器：

```json
{
  "servers": {
    "finance-data-server": {
      "url": "http://106.14.205.176:3101/sse",
      "transport": "sse"
    },
    "your-custom-server": {
      "url": "http://your-server-url:port",
      "transport": "sse"
    }
  }
}
```

### 3. 前端配置

编辑 `frontend/config.json` 文件配置后端地址：

```json
{
  "backend": {
    "host": "localhost",
    "port": 8000,
    "protocol": "http",
    "wsProtocol": "ws"
  },
  "api": {
    "baseUrl": "http://localhost:8000",
    "wsUrl": "ws://localhost:8000"
  }
}
```

### 4. 启动应用

#### 启动后端服务器

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### 访问前端

方式1：直接打开HTML文件
```bash
# 在浏览器中打开
open frontend/index.html
```

方式2：使用HTTP服务器（推荐）
```bash
cd frontend
python -m http.server 3000
# 然后访问 http://localhost:3000
```

## 📁 项目结构

```
WebwithMCP/
├── backend/                    # 后端代码
│   ├── main.py                # FastAPI应用入口
│   ├── mcp_agent.py           # MCP智能体核心逻辑
│   ├── database.py            # 数据库操作
│   ├── mcp.json               # MCP服务器配置
│   ├── requirements.txt       # Python依赖
│   └── chat_history.db        # SQLite数据库文件
│
├── frontend/                   # 前端代码
│   ├── index.html             # 主聊天页面
│   ├── tools.html             # 工具列表页面
│   ├── config.json            # 前端配置文件
│   ├── css/
│   │   ├── style.css          # 主样式文件
│   │   └── tools.css          # 工具页面样式
│   ├── js/
│   │   ├── chat.js            # 聊天功能逻辑
│   │   ├── ws.js              # WebSocket通信
│   │   └── config.js          # 配置管理
│   └── 配置说明.md             # 前端配置详细说明
│
├── README.md                   # 项目说明文档
└── requirements.txt            # 项目总依赖
```

## 🎮 使用说明

### 基本聊天

1. 打开前端页面，等待WebSocket连接成功
2. 在输入框中输入问题
3. 按回车键或点击发送按钮
4. 观察AI回复和工具调用过程

### 工具调用

智能助手会自动识别需要调用的工具：

- **金融数据查询**: 股票价格、市场数据等
- **数据分析**: 图表生成、统计分析
- **更多工具**: 根据配置的MCP服务器扩展

### 对话历史

- 所有对话自动保存到SQLite数据库
- 可通过API接口查询历史记录
- 支持按会话ID和时间范围过滤

## 🔧 API接口

### WebSocket接口

- **路径**: `/ws/chat`
- **功能**: 实时聊天通信
- **消息格式**:
  ```json
  // 发送消息
  {"type": "user_msg", "content": "用户输入"}
  
  // 接收消息
  {"type": "ai_response_chunk", "content": "AI回复片段"}
  {"type": "tool_start", "tool_name": "工具名", "progress": "执行中"}
  {"type": "tool_end", "tool_name": "工具名", "result": "执行结果"}
  ```

### REST API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/tools` | GET | 获取可用工具列表 |
| `/api/history` | GET | 获取对话历史 |
| `/` | GET | API状态信息 |

## 🚀 部署指南

### 开发环境

```bash
# 后端开发模式
cd backend && uvicorn main:app --reload --port 8000

# 前端开发服务器
cd frontend && python -m http.server 3000
```

### 生产环境

#### 使用Docker (推荐)

```dockerfile
# Dockerfile示例
FROM python:3.9-slim

WORKDIR /app
COPY backend/ .
RUN pip install -r requirements.txt

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### 使用Nginx反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端静态文件
    location / {
        root /path/to/frontend;
        try_files $uri $uri/ /index.html;
    }
    
    # 后端API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 🛠️ 开发指南

### 添加新的MCP工具

1. 在 `backend/mcp.json` 中添加新的服务器配置
2. 重启后端服务，工具会自动加载
3. 前端无需修改，会自动识别新工具

### 自定义前端主题

编辑 `frontend/css/style.css` 文件：

```css
:root {
  --primary-color: #your-color;
  --background-color: #your-bg;
  /* 更多样式变量 */
}
```

### 扩展数据库功能

参考 `backend/database.py` 文件，基于SQLite架构扩展：

```python
async def your_custom_function(self):
    # 自定义数据库操作
    pass
```

## 🤝 贡献指南

我们欢迎所有形式的贡献！

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📞 联系我们

如果您有任何问题或建议，欢迎联系：

- **GitHub**: [guangxiangdebizi/WebwithMCP](https://github.com/guangxiangdebizi/WebwithMCP)
- **Email**: [guangxiangdebizi@gmail.com](mailto:guangxiangdebizi@gmail.com)
- **LinkedIn**: [Xingyu Chen](https://www.linkedin.com/in/xingyu-chen-b5b3b0313/)

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

感谢以下开源项目：

- [FastAPI](https://fastapi.tiangolo.com/) - 现代、快速的Web框架
- [LangChain](https://langchain.com/) - AI应用开发框架
- [Model Context Protocol](https://modelcontextprotocol.io/) - AI工具集成协议

---

⭐ 如果这个项目对您有帮助，请给它一个星标！ 