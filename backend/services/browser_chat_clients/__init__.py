"""
浏览器聊天客户端抽象层

支持多个 AI 聊天网站的浏览器自动化访问：
- chat.qwen.ai (通义千问)
- www.qianwen.com (通义千问国内版)
- www.doubao.com (豆包)
"""

from .base_client import BaseBrowserChatClient, ChatResponse, ClientConfig
from .client_factory import ClientFactory, get_client, get_available_sites
from .qwen_ai_client import QwenAIClient
from .qianwen_client import QianwenClient
from .doubao_client import DoubaoClient

__all__ = [
    # 基类
    "BaseBrowserChatClient",
    "ChatResponse",
    "ClientConfig",
    # 工厂
    "ClientFactory",
    "get_client",
    "get_available_sites",
    # 具体实现
    "QwenAIClient",
    "QianwenClient",
    "DoubaoClient",
]
