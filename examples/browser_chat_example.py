"""
浏览器聊天客户端使用示例

展示如何使用抽象客户端架构访问不同的 AI 聊天网站。
"""

import asyncio
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.browser_chat_clients import (
    get_client,
    get_available_sites,
    ClientFactory,
    QwenAIClient,
    QianwenClient,
    DoubaoClient,
)


async def example_basic_usage():
    """基本使用示例"""
    print("=" * 50)
    print("基本使用示例")
    print("=" * 50)

    # 获取可用站点
    sites = get_available_sites()
    print(f"可用站点: {sites}")

    # 创建客户端（使用便捷函数）
    client = get_client("qwen.ai")

    # 使用异步上下文管理器
    async with client:
        # 发送消息并获取回复
        response = await client.chat("你好，请介绍一下你自己")
        print(f"回复: {response.content[:200]}...")
        print(f"成功: {response.success}")
        if response.error:
            print(f"错误: {response.error}")


async def example_multiple_sites():
    """多站点示例"""
    print("\n" + "=" * 50)
    print("多站点示例")
    print("=" * 50)

    # 测试不同的站点
    sites_to_test = ["qwen.ai", "qianwen.com"]

    for site in sites_to_test:
        print(f"\n测试站点: {site}")
        print("-" * 30)

        try:
            client = get_client(site)
            async with client:
                response = await client.chat("你好")
                if response.success:
                    print(f"✓ 成功: {response.content[:100]}...")
                else:
                    print(f"✗ 失败: {response.error}")
        except Exception as e:
            print(f"✗ 异常: {e}")


async def example_stream_chat():
    """流式聊天示例"""
    print("\n" + "=" * 50)
    print("流式聊天示例")
    print("=" * 50)

    client = get_client("qwen.ai")

    async with client:
        print("回复: ", end="", flush=True)
        async for chunk in client.chat_stream("请用 100 字介绍一下人工智能"):
            print(chunk, end="", flush=True)
        print()  # 换行


async def example_image_generation():
    """图片生成示例"""
    print("\n" + "=" * 50)
    print("图片生成示例")
    print("=" * 50)

    client = get_client("qwen.ai")

    async with client:
        response = await client.generate_image(
            "一只可爱的卡通猫咪，坐在月亮上",
            aspect_ratio="1:1"
        )
        if response.success:
            print(f"✓ 图片生成成功")
            print(f"  图片数量: {len(response.images)}")
            for i, img in enumerate(response.images):
                print(f"  图片 {i+1}: {img}")
        else:
            print(f"✗ 图片生成失败: {response.error}")


async def example_file_upload():
    """文件上传示例"""
    print("\n" + "=" * 50)
    print("文件上传示例")
    print("=" * 50)

    # 创建测试文件
    test_file = "test_upload.txt"
    with open(test_file, "w", encoding="utf-8") as f:
        f.write("这是一个测试文件。\n")
        f.write("Hello, this is a test file.\n")

    try:
        client = get_client("qwen.ai")

        async with client:
            response = await client.upload_and_chat(
                test_file,
                "请总结这个文件的内容"
            )
            if response.success:
                print(f"✓ 上传并聊天成功")
                print(f"  回复: {response.content[:200]}...")
            else:
                print(f"✗ 失败: {response.error}")
    finally:
        # 清理测试文件
        if os.path.exists(test_file):
            os.remove(test_file)


async def example_custom_config():
    """自定义配置示例"""
    print("\n" + "=" * 50)
    print("自定义配置示例")
    print("=" * 50)

    from backend.services.browser_chat_clients import ClientConfig

    # 创建自定义配置
    config = ClientConfig(
        headless=False,  # 显示浏览器窗口
        pool_size=3,     # 3 个页签
        timeout=60,      # 60 秒超时
        debug_screenshots=True,  # 启用调试截图
    )

    # 使用工厂创建客户端
    client = ClientFactory.create("qwen.ai", config=config)

    async with client:
        response = await client.chat("你好")
        print(f"回复: {response.content[:100]}...")


async def example_register_custom_client():
    """注册自定义客户端示例"""
    print("\n" + "=" * 50)
    print("注册自定义客户端示例")
    print("=" * 50)

    from backend.services.browser_chat_clients.base_client import (
        BaseBrowserChatClient,
        ClientConfig,
        ChatResponse,
    )

    # 创建自定义客户端类
    class MyCustomClient(BaseBrowserChatClient):
        @property
        def site_name(self) -> str:
            return "custom"

        @property
        def site_url(self) -> str:
            return "https://example.com"

        @classmethod
        def get_default_config(cls) -> ClientConfig:
            return ClientConfig(site_url="https://example.com")

        async def start(self, retries: int = 3) -> bool:
            print("自定义客户端启动")
            self._is_ready = True
            return True

        async def close(self) -> None:
            print("自定义客户端关闭")
            self._is_ready = False

        async def _check_alive(self) -> bool:
            return self._is_ready

        async def _navigate_to_chat(self, page) -> bool:
            return True

        async def _find_input_element(self, page):
            return None

        async def _find_send_button(self, page):
            return None

        async def _get_reply_content(self, page):
            return "这是自定义客户端的回复"

        async def _is_generating(self, page) -> bool:
            return False

        async def _dismiss_popup(self, page) -> bool:
            return False

        async def _select_image_mode(self, page, aspect_ratio=None) -> bool:
            return False

        async def _upload_file(self, page, file_path: str) -> bool:
            return False

    # 注册自定义客户端
    ClientFactory.register("custom", MyCustomClient)

    # 使用自定义客户端
    client = get_client("custom")
    async with client:
        response = await client.chat("测试")
        print(f"回复: {response.content}")


async def main():
    """主函数"""
    print("浏览器聊天客户端使用示例")
    print("=" * 50)

    # 运行示例（注释掉需要实际浏览器的示例）
    # await example_basic_usage()
    # await example_multiple_sites()
    # await example_stream_chat()
    # await example_image_generation()
    # await example_file_upload()
    # await example_custom_config()
    await example_register_custom_client()

    print("\n" + "=" * 50)
    print("示例完成")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
