# mcp_agent.py
"""
MCP智能体封装 - 为Web后端使用
基于 test.py 中的 SimpleMCPAgent，优化为适合WebSocket流式推送的版本
"""

import os
import json
import asyncio
from typing import Dict, List, Any, AsyncGenerator
from pathlib import Path
from datetime import datetime, timedelta

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage
from langchain_mcp_adapters.client import MultiServerMCPClient

# ─────────── 1. 大模型配置 ───────────
MODEL_CONFIG = {
    "api_key": "sk-df2c763fc1d14b20b630dc5ac474d8c2",  # ← 改为您的API Key
    "base_url": "https://api.deepseek.com/v1",  # ← 改为您的API地址
    "model_name": "deepseek-chat",  # ← 改为您的模型名称
    "temperature": 0.2,
    "timeout": 60
}


# ─────────── 2. MCP配置管理 ───────────
class MCPConfig:
    """MCP配置管理"""

    def __init__(self, config_file: str = "mcp.json"):
        self.config_file = config_file
        self.default_config = {}

    def load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        if Path(self.config_file).exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ 配置文件加载失败，使用默认配置: {e}")

        # 创建默认配置文件
        self.save_config(self.default_config)
        return self.default_config

    def save_config(self, config: Dict[str, Any]):
        """保存配置文件"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"❌ 配置文件保存失败: {e}")


# ─────────── 3. Web版MCP智能体 ───────────
class WebMCPAgent:
    """Web版MCP智能体 - 支持流式推送"""

    def __init__(self):
        # 修复：使用backend目录下的配置文件
        config_path = Path(__file__).parent / "mcp.json"
        self.config = MCPConfig(str(config_path))
        self.llm = None
        self.mcp_client = None
        self.tools = []
        # 新增：按服务器分组的工具存储
        self.tools_by_server = {}
        self.server_configs = {}

        # 设置API环境变量
        os.environ["OPENAI_API_KEY"] = MODEL_CONFIG["api_key"]
        os.environ["OPENAI_BASE_URL"] = MODEL_CONFIG["base_url"]

    async def initialize(self):
        """初始化智能体"""
        try:
            # 初始化大模型
            self.llm = ChatOpenAI(
                model_name=MODEL_CONFIG["model_name"],
                temperature=MODEL_CONFIG["temperature"],
                request_timeout=MODEL_CONFIG["timeout"],
                max_retries=3,
            )

            # 加载MCP配置并连接
            mcp_config = self.config.load_config()
            self.server_configs = mcp_config["servers"]

            if not self.server_configs:
                print("❌ 没有配置MCP服务器")
                return False

            print("🔗 正在连接MCP服务器...")
            
            # 先测试服务器连接
            import aiohttp
            import asyncio
            
            for server_name, server_config in self.server_configs.items():
                try:
                    print(f"🧪 测试连接到 {server_name}: {server_config['url']}")
                    async with aiohttp.ClientSession() as session:
                        async with session.get(server_config['url'], timeout=aiohttp.ClientTimeout(total=10)) as response:
                            print(f"✅ {server_name} 连接测试成功 (状态: {response.status})")
                except Exception as test_e:
                    print(f"⚠️ {server_name} 连接测试失败: {test_e}")
            
            # 创建MCP客户端 - 强制清除缓存并禁用HTTP/2
            import httpx

            def http_client_factory(headers=None, timeout=None, auth=None):
                return httpx.AsyncClient(
                    http2=False,  # 禁用HTTP/2
                    headers=headers,
                    timeout=timeout,
                    auth=auth
                )

            # 更新服务器配置以使用自定义的httpx客户端工厂
            for server_name in self.server_configs:
                self.server_configs[server_name]['httpx_client_factory'] = http_client_factory

            self.mcp_client = MultiServerMCPClient(self.server_configs)

            # 改为串行获取工具，避免并发问题
            print("🔧 正在逐个获取服务器工具...")
            for server_name in self.server_configs.keys():
                try:
                    print(f"─── 正在从服务器 '{server_name}' 获取工具 ───")
                    server_tools = await self.mcp_client.get_tools(server_name=server_name)
                    self.tools.extend(server_tools)
                    self.tools_by_server[server_name] = server_tools
                    print(f"✅ 从 {server_name} 获取到 {len(server_tools)} 个工具")
                except Exception as e:
                    print(f"❌ 从服务器 '{server_name}' 获取工具失败: {e}")
                    self.tools_by_server[server_name] = []
            
            # 验证工具来源，确保只有配置文件中的服务器
            print(f"🔍 配置的服务器: {list(self.server_configs.keys())}")
            print(f"🔍 实际获取到的工具数量: {len(self.tools)}")
            
            # 分组逻辑已在上面的循环中完成，无需额外调用

            print(f"✅ 成功连接，获取到 {len(self.tools)} 个工具")
            print(f"📊 服务器分组情况: {dict((name, len(tools)) for name, tools in self.tools_by_server.items())}")

            # 绑定工具到大模型
            self.llm = self.llm.bind_tools(self.tools)

            print("🤖 Web MCP智能助手已启动！")
            return True

        except Exception as e:
            import traceback
            print(f"❌ 初始化失败: {e}")
            print(f"📋 详细错误信息:")
            traceback.print_exc()
            
            # 尝试清理可能的连接
            if hasattr(self, 'mcp_client') and self.mcp_client:
                try:
                    await self.mcp_client.close()
                except:
                    pass
            return False

    def _get_system_prompt(self) -> str:
        """获取系统提示词"""
        now = datetime.now()
        current_date = now.strftime("%Y年%m月%d日")
        current_weekday = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][now.weekday()]

        return f"""你是一个智能助手，可以调用MCP工具来帮助用户完成各种任务。

当前时间信息：
📅 今天是：{current_date} ({current_weekday})

工作原则：
1. 仔细分析用户需求
2. 选择合适的工具来完成任务
3. 清楚地解释操作过程和结果
4. 如果遇到问题，提供具体的解决建议

请始终以用户需求为中心，高效地使用可用工具。"""

    async def chat_stream(self, user_input: str) -> AsyncGenerator[Dict[str, Any], None]:
        """流式处理用户输入 - 为WebSocket推送优化"""
        try:
            yield {"type": "status", "content": "开始分析用户需求..."}

            # 构建消息历史
            messages = [
                {"role": "system", "content": self._get_system_prompt()},
                {"role": "user", "content": user_input}
            ]
            max_iterations = 10
            iteration = 0

            while iteration < max_iterations:
                iteration += 1

                yield {"type": "status", "content": f"第 {iteration} 轮推理..."}

                # 调用大模型进行推理
                response = await self.llm.ainvoke(messages)

                # 检查是否有工具调用
                if hasattr(response, 'tool_calls') and response.tool_calls:
                    yield {
                        "type": "tool_plan",
                        "content": f"AI决定调用 {len(response.tool_calls)} 个工具",
                        "tool_count": len(response.tool_calls)
                    }

                    # 串行执行每个工具调用
                    for i, tool_call in enumerate(response.tool_calls, 1):
                        tool_name = tool_call['name']
                        tool_args = tool_call['args']
                        tool_id = tool_call.get('id', f"call_{i}")

                        # 推送工具开始执行
                        yield {
                            "type": "tool_start",
                            "tool_id": tool_id,
                            "tool_name": tool_name,
                            "tool_args": tool_args,
                            "progress": f"{i}/{len(response.tool_calls)}"
                        }

                        try:
                            # 查找对应的工具
                            target_tool = None
                            for tool in self.tools:
                                if tool.name == tool_name:
                                    target_tool = tool
                                    break

                            if target_tool is None:
                                error_msg = f"工具 '{tool_name}' 未找到"
                                yield {
                                    "type": "tool_error",
                                    "tool_id": tool_id,
                                    "error": error_msg
                                }
                                tool_result = f"错误: {error_msg}"
                            else:
                                # 执行工具
                                tool_result = await target_tool.ainvoke(tool_args)

                                # 推送工具执行结果
                                yield {
                                    "type": "tool_end",
                                    "tool_id": tool_id,
                                    "tool_name": tool_name,
                                    "result": str(tool_result)
                                }

                        except Exception as e:
                            error_msg = f"工具执行出错: {e}"
                            yield {
                                "type": "tool_error",
                                "tool_id": tool_id,
                                "error": error_msg
                            }
                            tool_result = f"错误: {error_msg}"

                        # 将工具结果添加到消息历史
                        messages.append({
                            "role": "assistant",
                            "content": response.content or "",
                            "tool_calls": [tool_call]
                        })
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_id,
                            "name": tool_name,
                            "content": str(tool_result)
                        })

                    # 继续下一轮推理
                    continue

                else:
                    # 没有工具调用，这是最终回复
                    final_response = response.content or ""

                    # 流式推送最终回复
                    yield {
                        "type": "ai_response_start",
                        "content": "AI正在整理回复..."
                    }

                    # 模拟流式输出（可根据需要调整）
                    chunk_size = 10
                    for i in range(0, len(final_response), chunk_size):
                        chunk = final_response[i:i + chunk_size]
                        yield {
                            "type": "ai_response_chunk",
                            "content": chunk
                        }
                        await asyncio.sleep(0.05)  # 小延迟模拟流式效果

                    yield {
                        "type": "ai_response_end",
                        "content": final_response
                    }

                    return

            # 达到最大迭代次数
            yield {
                "type": "error",
                "content": f"达到最大推理轮数 ({max_iterations})，停止执行"
            }

        except Exception as e:
            yield {
                "type": "error",
                "content": f"处理请求时出错: {e}"
            }

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

    async def close(self):
        """关闭连接"""
        try:
            if self.mcp_client and hasattr(self.mcp_client, 'close'):
                await self.mcp_client.close()
        except:
            pass