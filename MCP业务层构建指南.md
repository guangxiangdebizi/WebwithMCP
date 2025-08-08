# MCP业务层构建指南

## 核心模块

### 1. MCP工具识别机制
### 2. 大模型使用MCP工具
### 3. 关键库与示例

## 1. MCP工具识别机制

### 配置文件 (`mcp.json`)
```json
{
  "servers": {
    "finance-data-server": {
      "url": "http://106.14.205.176:3101/sse",
      "transport": "sse",
      "timeout": 600
    }
  }
}
```

### 工具发现代码
```python
from langchain_mcp_adapters.client import MultiServerMCPClient

# 创建MCP客户端
client = MultiServerMCPClient({
    "finance": {
        "url": "http://106.14.205.176:3101/sse",
        "transport": "sse",
        "timeout": 600
    }
})

# 获取所有工具
tools = await client.get_tools()
```

## 大模型使用MCP工具

### 工具绑定到大模型
```python
from langchain_openai import ChatOpenAI
from langchain_mcp_adapters.client import MultiServerMCPClient

# 初始化大模型
llm = ChatOpenAI(model="gpt-4", temperature=0)

# 创建MCP客户端并获取工具
client = MultiServerMCPClient({
    "finance": {
        "url": "http://106.14.205.176:3101/sse",
        "transport": "sse"
    }
})
tools = await client.get_tools()

# 绑定工具到大模型
llm_with_tools = llm.bind_tools(tools)
```

### 工具信息获取方法
```python
def get_tools_info(self) -> Dict[str, Any]:
    """获取工具信息列表，按MCP服务器分组"""
    if not self.tools_by_server:
        return {"servers": {}, "total_tools": 0, "server_count": 0}
    
    servers_info = {}
    total_tools = 0
    
    # 按服务器分组构建工具信息
    for server_name, server_tools in self.tools_by_server.items():
        tools_info = []
        
        for tool in server_tools:
            tool_info = {
                "name": tool.name,
                "description": tool.description,
                "parameters": {},
                "required": []
            }
            
            # 获取参数信息 - 优化版本
            try:
                schema = None
                
                # 方法1: 尝试使用args_schema (LangChain工具常用)
                if hasattr(tool, 'args_schema') and tool.args_schema:
                    if isinstance(tool.args_schema, dict):
                        schema = tool.args_schema
                    elif hasattr(tool.args_schema, 'model_json_schema'):
                        schema = tool.args_schema.model_json_schema()
                
                # 方法2: 如果没有args_schema，尝试tool_call_schema
                if not schema and hasattr(tool, 'tool_call_schema') and tool.tool_call_schema:
                    schema = tool.tool_call_schema
                
                # 方法3: 最后尝试input_schema
                if not schema and hasattr(tool, 'input_schema') and tool.input_schema:
                    if isinstance(tool.input_schema, dict):
                        schema = tool.input_schema
                    elif hasattr(tool.input_schema, 'model_json_schema'):
                        try:
                            schema = tool.input_schema.model_json_schema()
                        except:
                            pass
                
                # 解析schema
                if schema and isinstance(schema, dict):
                    if 'properties' in schema:
                        tool_info["parameters"] = schema['properties']
                        tool_info["required"] = schema.get('required', [])
                    elif 'type' in schema and schema.get('type') == 'object' and 'properties' in schema:
                        tool_info["parameters"] = schema['properties']
                        tool_info["required"] = schema.get('required', [])
            
            except Exception as e:
                # 如果出错，至少保留工具的基本信息
                print(f"⚠️ 获取工具 '{tool.name}' 参数信息失败: {e}")
            
            tools_info.append(tool_info)
        
        # 添加服务器信息
        servers_info[server_name] = {
            "name": server_name,
            "tools": tools_info,
            "tool_count": len(tools_info)
        }
        
        total_tools += len(tools_info)
    
    return {
        "servers": servers_info,
        "total_tools": total_tools,
        "server_count": len(servers_info)
    }
```

### 工具调用执行
```python
# AI推理并调用工具
response = await llm_with_tools.ainvoke(messages)

# 处理工具调用
if response.tool_calls:
    for tool_call in response.tool_calls:
        tool_name = tool_call['name']
        tool_args = tool_call['args']
        
        # 查找并执行工具
        target_tool = next((t for t in tools if t.name == tool_name), None)
        if target_tool:
            result = await target_tool.ainvoke(tool_args)
            # 将结果反馈给AI继续推理
```

## 3. 关键库与示例

### 核心依赖
```python
# requirements.txt
langchain-openai==0.1.8
langchain-mcp-adapters==0.1.0
mcp-client==1.0.0
fastapi==0.104.1
uvicorn==0.24.0
```

### 完整示例
```python
import asyncio
from langchain_openai import ChatOpenAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent

class MCPAgent:
    def __init__(self):
        self.llm = ChatOpenAI(model="gpt-4", temperature=0)
        self.client = None
        self.tools = []
    
    async def initialize(self):
        # 创建MCP客户端
        self.client = MultiServerMCPClient({
            "finance": {
                "url": "http://106.14.205.176:3101/sse",
                "transport": "sse",
                "timeout": 600
            }
        })
        
        # 获取工具
        self.tools = await self.client.get_tools()
        
        # 创建React Agent
        self.agent = create_react_agent(self.llm, self.tools)
    
    async def chat(self, message: str):
        response = await self.agent.ainvoke({
            "messages": [{"role": "user", "content": message}]
        })
        return response["messages"][-1].content
    
    async def close(self):
        if self.client:
            await self.client.close()

# 使用示例
async def main():
    agent = MCPAgent()
    try:
        await agent.initialize()
        result = await agent.chat("查询苹果公司股价")
        print(result)
    finally:
        await agent.close()

asyncio.run(main())
```