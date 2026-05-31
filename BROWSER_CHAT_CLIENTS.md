# 浏览器聊天客户端抽象层

## 概述

这个模块提供了一个统一的接口，用于通过浏览器自动化访问不同的 AI 聊天网站。通过抽象层设计，可以轻松扩展支持新的站点，同时保持代码的一致性和可维护性。

## 支持的站点

| 站点 | 客户端类 | URL | 状态 |
|------|----------|-----|------|
| 通义千问 | `QwenAIClient` | chat.qwen.ai | ✅ 完整支持 |
| 通义千问国内版 | `QianwenClient` | www.qianwen.com | ✅ 完整支持 |
| 豆包 | `DoubaoClient` | www.doubao.com | 🚧 基础支持 |

## 功能特性

- ✅ **文本聊天** - 发送消息并获取回复
- ✅ **流式聊天** - 实时获取回复片段
- ✅ **图片生成** - 通过 AI 生成图片
- ✅ **文件上传** - 上传文件并进行分析
- ✅ **多页签池** - 支持并发请求
- ✅ **自动弹窗处理** - 自动关闭登录弹窗
- ✅ **异步上下文管理器** - 自动管理资源生命周期

## 快速开始

### 安装依赖

```bash
pip install camoufox
```

### 基本使用

```python
import asyncio
from backend.services.browser_chat_clients import get_client

async def main():
    # 创建客户端
    client = get_client("qwen.ai")

    # 使用异步上下文管理器
    async with client:
        # 发送消息并获取回复
        response = await client.chat("你好")
        print(response.content)

asyncio.run(main())
```

### 流式聊天

```python
import asyncio
from backend.services.browser_chat_clients import get_client

async def main():
    client = get_client("qwen.ai")

    async with client:
        async for chunk in client.chat_stream("请介绍一下人工智能"):
            print(chunk, end="", flush=True)

asyncio.run(main())
```

### 图片生成

```python
import asyncio
from backend.services.browser_chat_clients import get_client

async def main():
    client = get_client("qwen.ai")

    async with client:
        response = await client.generate_image(
            "一只可爱的卡通猫咪",
            aspect_ratio="1:1"
        )
        if response.success:
            for img in response.images:
                print(f"图片: {img}")

asyncio.run(main())
```

### 文件上传

```python
import asyncio
from backend.services.browser_chat_clients import get_client

async def main():
    client = get_client("qwen.ai")

    async with client:
        response = await client.upload_and_chat(
            "path/to/file.txt",
            "请总结这个文件的内容"
        )
        print(response.content)

asyncio.run(main())
```

## 高级用法

### 自定义配置

```python
from backend.services.browser_chat_clients import ClientConfig, ClientFactory

# 创建自定义配置
config = ClientConfig(
    headless=False,      # 显示浏览器窗口
    pool_size=3,         # 3 个页签
    timeout=60,          # 60 秒超时
    debug_screenshots=True,  # 启用调试截图
)

# 使用工厂创建客户端
client = ClientFactory.create("qwen.ai", config=config)
```

### 多站点切换

```python
from backend.services.browser_chat_clients import get_client, get_available_sites

# 获取可用站点
sites = get_available_sites()
print(f"可用站点: {sites}")

# 创建不同站点的客户端
qwen_client = get_client("qwen.ai")
qianwen_client = get_client("qianwen.com")
doubao_client = get_client("doubao.com")
```

### 注册自定义客户端

```python
from backend.services.browser_chat_clients import (
    BaseBrowserChatClient,
    ClientConfig,
    ClientFactory,
)

class MyCustomClient(BaseBrowserChatClient):
    # 实现所有抽象方法...
    pass

# 注册自定义客户端
ClientFactory.register("custom", MyCustomClient)

# 使用自定义客户端
client = get_client("custom")
```

## 架构说明

### 模块结构

```
backend/services/browser_chat_clients/
├── __init__.py          # 模块导出
├── base_client.py       # 抽象基类
├── client_factory.py    # 客户端工厂
├── qwen_ai_client.py    # Qwen AI 客户端
├── qianwen_client.py    # Qianwen 客户端
├── doubao_client.py     # Doubao 客户端
└── README.md            # 文档
```

### 类继承关系

```
BaseBrowserChatClient (抽象基类)
├── QwenAIClient      (chat.qwen.ai)
├── QianwenClient     (www.qianwen.com)
└── DoubaoClient      (www.doubao.com)
```

### 核心接口

所有客户端必须实现以下抽象方法：

#### 生命周期
- `start()` - 启动浏览器
- `close()` - 关闭浏览器
- `_check_alive()` - 检查浏览器状态

#### 页面交互
- `_navigate_to_chat()` - 导航到聊天页面
- `_find_input_element()` - 查找输入框
- `_find_send_button()` - 查找发送按钮
- `_get_reply_content()` - 获取回复内容
- `_is_generating()` - 检查是否正在生成
- `_dismiss_popup()` - 关闭弹窗

#### 高级功能
- `_select_image_mode()` - 切换图片生成模式
- `_upload_file()` - 上传文件

## 扩展新站点

要添加对新站点的支持，请按照以下步骤：

### 1. 创建新的客户端类

```python
# new_site_client.py
from .base_client import BaseBrowserChatClient, ClientConfig

class NewSiteClient(BaseBrowserChatClient):
    @property
    def site_name(self) -> str:
        return "new_site"

    @property
    def site_url(self) -> str:
        return "https://new-site.com"

    @classmethod
    def get_default_config(cls) -> ClientConfig:
        return ClientConfig(
            site_url="https://new-site.com",
            guest_url="https://new-site.com/chat/",
        )

    # 实现所有其他抽象方法...
```

### 2. 注册新客户端

```python
# 在 client_factory.py 中添加
from .new_site_client import NewSiteClient

_CLIENT_REGISTRY["new_site"] = NewSiteClient
```

### 3. 使用新客户端

```python
from backend.services.browser_chat_clients import get_client

client = get_client("new_site")
async with client:
    response = await client.chat("你好")
```

## API 参考

### ClientConfig

```python
@dataclass
class ClientConfig:
    headless: bool = True           # 是否无头模式
    pool_size: int = 5              # 页签池大小
    timeout: int = 120              # 超时时间（秒）
    site_url: str = ""              # 站点 URL
    guest_url: str = ""             # 访客页面 URL
    debug_screenshots: bool = False # 是否启用调试截图
    screenshot_dir: str = ""        # 截图保存目录
    extra: Dict[str, Any] = {}      # 额外配置
```

### ChatResponse

```python
@dataclass
class ChatResponse:
    content: str                    # 回复内容
    success: bool = True            # 是否成功
    error: str = ""                 # 错误信息
    images: List[str] = []          # 生成的图片 URL
    metadata: Dict[str, Any] = {}   # 额外元数据
```

### BaseBrowserChatClient

```python
class BaseBrowserChatClient(ABC):
    # 属性
    site_name: str                  # 站点名称
    site_url: str                   # 站点 URL

    # 方法
    async def start(retries=3) -> bool
    async def close() -> None
    async def chat(message, timeout=None) -> ChatResponse
    async def chat_stream(message, timeout=None) -> AsyncIterator[str]
    async def generate_image(prompt, aspect_ratio=None, timeout=180) -> ChatResponse
    async def upload_and_chat(file_path, message, timeout=None) -> ChatResponse
```

### ClientFactory

```python
class ClientFactory:
    @staticmethod
    def create(site, config=None, **kwargs) -> BaseBrowserChatClient

    @staticmethod
    def register(site, client_class) -> None

    @staticmethod
    def get_available_sites() -> List[str]
```

## 注意事项

1. **反检测**: 所有客户端使用 Camoufox 浏览器，具有反检测能力
2. **资源管理**: 使用异步上下文管理器确保资源正确释放
3. **并发控制**: 使用锁确保同一时间只有一个请求在处理
4. **超时处理**: 所有操作都有超时控制
5. **错误处理**: 完善的错误处理和日志记录

## 依赖

- Python 3.10+
- camoufox
- playwright (通过 camoufox)

## 测试

运行测试：

```bash
python tests/test_browser_chat_clients.py
```

## 示例

查看 `examples/browser_chat_example.py` 获取更多使用示例。

## 许可证

与主项目相同。
