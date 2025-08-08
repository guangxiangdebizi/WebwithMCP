# SQLite聊天记录数据库

## 概述

本系统使用SQLite数据库存储聊天记录，包括：
- 用户输入的问题
- MCP工具调用信息和返回结果
- AI的回复内容

## 数据库结构

### 表结构

#### chat_sessions (聊天会话表)
- `id`: 主键
- `session_id`: 会话ID (默认: "default")
- `created_at`: 创建时间
- `updated_at`: 更新时间

#### chat_records (聊天记录表)  
- `id`: 主键
- `session_id`: 会话ID
- `conversation_id`: 对话ID
- `user_input`: 用户输入的问题
- `user_timestamp`: 用户输入时间
- `mcp_tools_called`: 调用的MCP工具信息 (JSON格式)
- `mcp_results`: MCP工具返回结果 (JSON格式)
- `ai_response`: AI回复内容
- `ai_timestamp`: AI回复时间
- `created_at`: 记录创建时间

## 数据库文件位置

默认位置：`backend/chat_history.db`

## API接口

### 获取聊天历史
```
GET /api/history?limit=50&session_id=default&conversation_id=1
```

### 清空聊天历史
```
DELETE /api/history?session_id=default
```

### 获取系统状态（包含数据库统计）
```
GET /api/status
```

### 获取数据库详细统计
```
GET /api/database/stats
```

## 使用方法

1. **安装依赖**：
   ```bash
   pip install aiosqlite sqlalchemy python-dotenv
   ```

2. **启动服务**：
   数据库会在应用启动时自动初始化

3. **查看数据库**：
   可以使用SQLite客户端工具查看 `chat_history.db` 文件

## 数据示例

### 存储的MCP工具调用信息
```json
[
  {
    "tool_id": "call_1",
    "tool_name": "get_stock_data",
    "tool_args": {"symbol": "AAPL"},
    "progress": "1/2"
  }
]
```

### 存储的MCP工具结果
```json
[
  {
    "tool_id": "call_1", 
    "tool_name": "get_stock_data",
    "result": "AAPL股价数据...",
    "success": true
  }
]
```

## 特性

- **自动初始化**：首次运行时自动创建表结构
- **异步操作**：使用aiosqlite支持异步数据库操作
- **完整记录**：记录用户问题、工具调用、AI回复的完整对话流程
- **会话管理**：支持多会话隔离存储
- **统计信息**：提供详细的数据库使用统计

## 维护

数据库文件会持续增长，建议定期：
1. 备份重要对话记录
2. 清理过期的会话数据
3. 监控数据库文件大小 