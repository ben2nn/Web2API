# 浏览器聊天客户端抽象层

这个模块提供了一个统一的接口，用于通过浏览器自动化访问不同的 AI 聊天网站。

## 支持的站点

| 站点 | 客户端类 | URL | 状态 |
|------|----------|-----|------|
| 通义千问 | `QwenAIClient` | chat.qwen.ai | ✅ 完整支持 |
| 通义千问国内版 | `QianwenClient` | www.qianwen.com | ✅ 完整支持 |
| 豆包 | `DoubaoClient` | www.doubao.com | 🚧 基础支持 |

## 功能特性

- ✅ 文本聊天
- ✅ 流式聊天
- ✅ 图片生成
- ✅ 文件上传
- ✅ 多页签池并发
- ✅ 自动弹窗处理
- ✅ 异步上下文管理器

## 快速开始

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
browser_chat_clients/
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

1. 创建新的客户端类，继承 `BaseBrowserChatClient`
2. 实现所有抽象方法
3. 在 `client_factory.py` 中注册新客户端

```python
# 1. 创建客户端类
class NewSiteClient(BaseBrowserChatClient):
    # 实现抽象方法...
    pass

# 2. 注册客户端
from backend.services.browser_chat_clients import ClientFactory
ClientFactory.register("new_site", NewSiteClient)

# 3. 使用
client = get_client("new_site")
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

## 许可证

与主项目相同。
