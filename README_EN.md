# 🤖 MCP Web Assistant (WebwithMCP)

An intelligent conversational assistant web application based on **MCP (Model Context Protocol)**, supporting real-time chat, tool invocation, and conversation history management.

[![GitHub Stars](https://img.shields.io/github/stars/guangxiangdebizi/WebwithMCP?style=social)](https://github.com/guangxiangdebizi/WebwithMCP)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.8+-blue.svg)](https://python.org)

## ✨ Features

- 🚀 **Frontend-Backend Separation**: FastAPI backend + Native frontend, clear architecture
- 💬 **Real-time Communication**: WebSocket support for streaming conversations and tool execution progress
- 🔧 **MCP Tool Integration**: Support various MCP tools to extend AI capabilities  
- 📊 **Conversation History**: SQLite database stores complete conversation records
- 🎨 **Modern UI**: Responsive design with Markdown rendering support
- ⚙️ **Flexible Configuration**: Support for multi-environment deployment configuration

## 🏗️ Technical Architecture

```
┌─────────────┐    WebSocket    ┌──────────────┐    MCP Protocol    ┌─────────────┐
│  Frontend   │ ←────────────→ │ FastAPI      │ ←───────────────→ │ MCP Tool    │
│ (HTML/JS)   │    REST API     │ Backend      │                   │ Services    │
└─────────────┘                └──────────────┘                   └─────────────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │ SQLite DB    │
                                │ (Chat Hist.) │
                                └──────────────┘
```

## 📋 Requirements

- **Python**: 3.8+
- **Node.js**: Optional (for frontend development only)
- **Browser**: Modern browser with WebSocket support

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/guangxiangdebizi/WebwithMCP.git
cd WebwithMCP
```

### 2. Backend Configuration

#### Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

#### Configure API Key

Edit the `MODEL_CONFIG` section in `backend/mcp_agent.py`:

```python
MODEL_CONFIG = {
    "api_key": "your-api-key-here",        # Replace with your API key
    "base_url": "https://api.deepseek.com/v1",  # API service URL
    "model_name": "deepseek-chat",              # Model name
    "temperature": 0.2,
    "timeout": 60
}
```

#### Configure MCP Servers (Optional)

Edit `backend/mcp.json` to add your MCP tool servers:

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

### 3. Frontend Configuration

Edit `frontend/config.json` to configure backend address:

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

### 4. Launch Application

#### Start Backend Server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Access Frontend

Method 1: Open HTML file directly
```bash
# Open in browser
open frontend/index.html
```

Method 2: Use HTTP server (Recommended)
```bash
cd frontend
python -m http.server 3000
# Then visit http://localhost:3000
```

## 📁 Project Structure

```
WebwithMCP/
├── backend/                    # Backend code
│   ├── main.py                # FastAPI application entry
│   ├── mcp_agent.py           # MCP agent core logic
│   ├── database.py            # Database operations
│   ├── mcp.json               # MCP server configuration
│   ├── requirements.txt       # Python dependencies
│   └── chat_history.db        # SQLite database file
│
├── frontend/                   # Frontend code
│   ├── index.html             # Main chat page
│   ├── tools.html             # Tools list page
│   ├── config.json            # Frontend configuration
│   ├── css/
│   │   ├── style.css          # Main stylesheet
│   │   └── tools.css          # Tools page stylesheet
│   ├── js/
│   │   ├── chat.js            # Chat functionality logic
│   │   ├── ws.js              # WebSocket communication
│   │   └── config.js          # Configuration management
│   └── 配置说明.md             # Frontend configuration guide
│
├── README.md                   # Project documentation (Chinese)
├── README_EN.md               # Project documentation (English)
└── requirements.txt            # Project dependencies
```

## 🎮 Usage Guide

### Basic Chat

1. Open the frontend page and wait for WebSocket connection
2. Type your question in the input box
3. Press Enter or click the send button
4. Observe AI responses and tool execution process

### Tool Invocation

The intelligent assistant automatically identifies tools to call:

- **Financial Data Query**: Stock prices, market data, etc.
- **Data Analysis**: Chart generation, statistical analysis
- **More Tools**: Extended based on configured MCP servers

### Conversation History

- All conversations are automatically saved to SQLite database
- Query history records through API interfaces
- Support filtering by session ID and time range

## 🔧 API Interfaces

### WebSocket Interface

- **Path**: `/ws/chat`
- **Function**: Real-time chat communication
- **Message Format**:
  ```json
  // Send message
  {"type": "user_msg", "content": "User input"}
  
  // Receive message
  {"type": "ai_response_chunk", "content": "AI response chunk"}
  {"type": "tool_start", "tool_name": "Tool name", "progress": "Executing"}
  {"type": "tool_end", "tool_name": "Tool name", "result": "Execution result"}
  ```

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tools` | GET | Get available tools list |
| `/api/history` | GET | Get conversation history |
| `/` | GET | API status information |

## 🚀 Deployment Guide

### Development Environment

```bash
# Backend development mode
cd backend && uvicorn main:app --reload --port 8000

# Frontend development server
cd frontend && python -m http.server 3000
```

### Production Environment

#### Using Docker (Recommended)

```dockerfile
# Dockerfile example
FROM python:3.9-slim

WORKDIR /app
COPY backend/ .
RUN pip install -r requirements.txt

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Using Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Frontend static files
    location / {
        root /path/to/frontend;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
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

## 🛠️ Development Guide

### Adding New MCP Tools

1. Add new server configuration in `backend/mcp.json`
2. Restart backend service, tools will be automatically loaded
3. No frontend modifications needed, new tools are automatically recognized

### Customizing Frontend Theme

Edit `frontend/css/style.css` file:

```css
:root {
  --primary-color: #your-color;
  --background-color: #your-bg;
  /* More style variables */
}
```

### Extending Database Functionality

Refer to `backend/database.py` file, extend based on SQLite architecture:

```python
async def your_custom_function(self):
    # Custom database operations
    pass
```

## 🤝 Contributing

We welcome all forms of contributions!

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Contact Us

If you have any questions or suggestions, feel free to contact:

- **GitHub**: [guangxiangdebizi/WebwithMCP](https://github.com/guangxiangdebizi/WebwithMCP)
- **Email**: [guangxiangdebizi@gmail.com](mailto:guangxiangdebizi@gmail.com)
- **LinkedIn**: [Xingyu Chen](https://www.linkedin.com/in/xingyu-chen-b5b3b0313/)

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Thanks to the following open source projects:

- [FastAPI](https://fastapi.tiangolo.com/) - Modern, fast web framework
- [LangChain](https://langchain.com/) - AI application development framework
- [Model Context Protocol](https://modelcontextprotocol.io/) - AI tool integration protocol

---

⭐ If this project helps you, please give it a star! 