"""
图片生成接口 — 兼容 OpenAI /v1/images/generations 规范。

底层通过现有直连 HTTP 聊天能力触发千问"生成图像"模式，
不依赖浏览器运行时。匿名模式下支持多图并发生成。
"""
import re
import time
import json
import asyncio
import base64
import logging
import tempfile
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from backend.services.qwen_client import QwenClient

log = logging.getLogger("qwen2api.images")
router = APIRouter()

DEFAULT_IMAGE_MODEL = "qwen3.6-plus"

IMAGE_MODEL_MAP = {
    "dall-e-3": "qwen3.6-plus",
    "dall-e-2": "qwen3.6-plus",
    "qwen-image": "qwen3.6-plus",
    "qwen-image-plus": "qwen3.6-plus",
    "qwen-image-turbo": "qwen3.6-plus",
    "qwen3.6-plus": "qwen3.6-plus",
}


def _extract_image_urls(text: str) -> list[str]:
    urls: list[str] = []

    for u in re.findall(r'!\[.*?\]\((https?://[^\s\)]+)\)', text):
        urls.append(u.rstrip(").,;"))

    for u in re.findall(r'"(?:url|image|src|imageUrl|image_url)"\s*:\s*"(https?://[^"]+)"', text):
        urls.append(u)

    cdn_pattern = r'https?://(?:cdn\.qwenlm\.ai|wanx\.alicdn\.com|img\.alicdn\.com|[^\s"<>]+\.(?:jpg|jpeg|png|webp|gif))(?:[^\s"<>]*)'
    for u in re.findall(cdn_pattern, text, re.IGNORECASE):
        urls.append(u.rstrip(".,;)\"'>"))

    seen: set[str] = set()
    result: list[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            result.append(u)
    return result


def _resolve_image_model(requested: str | None) -> str:
    if not requested:
        return DEFAULT_IMAGE_MODEL
    return IMAGE_MODEL_MAP.get(requested, DEFAULT_IMAGE_MODEL)


def _get_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return request.headers.get("x-api-key", "").strip()


def _build_image_prompt(prompt: str) -> str:
    # 匿名模式通过 UI 切换到图片生成模式，提示词直接传用户需求
    return prompt


def _save_base64_image(data_uri: str) -> str | None:
    """将 base64 data URI 保存为临时文件，返回文件路径。"""
    try:
        # 解析 data URI
        if data_uri.startswith("data:"):
            # 格式: data:image/jpeg;base64,/9j/4AAQ...
            header, encoded = data_uri.split(",", 1)
            # 提取 MIME 类型
            mime = header.split(";")[0].split(":")[1] if ":" in header else "image/jpeg"
        else:
            # 纯 base64
            encoded = data_uri
            mime = "image/jpeg"

        # 确定文件扩展名
        ext_map = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }
        ext = ext_map.get(mime, ".jpg")

        # 解码 base64
        raw = base64.b64decode(encoded)

        # 保存到临时文件
        temp_dir = Path(tempfile.gettempdir()) / "qwen2api_images"
        temp_dir.mkdir(exist_ok=True)
        temp_file = temp_dir / f"ref_{int(time.time() * 1000)}{ext}"
        temp_file.write_bytes(raw)

        log.info(f"[T2I] 保存参考图: {temp_file} ({len(raw)} bytes)")
        return str(temp_file)
    except Exception as e:
        log.error(f"[T2I] 保存参考图失败: {e}")
        return None


async def _generate_one_anonymous(prompt: str, aspect_ratio: str | None = None, file_path: str | None = None) -> str | None:
    """匿名模式生成单张图片，返回图片 URL 或 None。

    使用全局单例浏览器实例，避免每次调用都启动新浏览器（~20s）。
    """
    from backend.services.qwen_anonymous_client import get_anonymous_client

    client = await get_anonymous_client()
    try:
        resp = await client.chat(
            prompt,
            timeout_sec=180,
            mode="image",
            aspect_ratio=aspect_ratio,
            file_path=file_path,
        )
        if not resp.success:
            log.warning(f"[T2I] 匿名单图生成失败: {resp.error}")
            return None
        urls = _extract_image_urls(resp.content)
        return urls[0] if urls else None
    except Exception as e:
        log.error(f"[T2I] 匿名单图生成异常: {e}")
        return None


@router.post("/v1/images/generations")
@router.post("/images/generations")
async def create_image(request: Request):
    from backend.core.config import API_KEYS, settings

    client: QwenClient = request.app.state.qwen_client

    token = _get_token(request)
    if API_KEYS:
        if token != settings.ADMIN_KEY and token not in API_KEYS:
            raise HTTPException(status_code=401, detail="Invalid API Key")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON body")

    prompt: str = body.get("prompt", "").strip()
    # 允许有附件时 prompt 为空
    images_data: list[str] = body.get("images", [])
    if not prompt and not images_data:
        raise HTTPException(400, "prompt or images is required")
    if not prompt:
        prompt = "根据参考图生成"

    n: int = min(max(int(body.get("n", 1)), 1), 4)
    model = _resolve_image_model(body.get("model"))
    # 支持 ratio / aspect_ratio / 从 size 中解析
    ratio = body.get("ratio") or body.get("aspect_ratio")
    if not ratio:
        size_str = body.get("size", "")
        if "x" in str(size_str):
            try:
                w, h = str(size_str).lower().split("x")
                w, h = int(w), int(h)
                from math import gcd
                g = gcd(w, h)
                ratio = f"{w // g}:{h // g}"
            except Exception:
                pass

    # 处理参考图片
    ref_image_path = None
    if images_data:
        ref_image_path = _save_base64_image(images_data[0])
        if ref_image_path:
            log.info(f"[T2I] 参考图已保存: {ref_image_path}")

    log.info(f"[T2I] model={model}, n={n}, ratio={ratio}, prompt={prompt[:80]!r}, has_ref={ref_image_path is not None}")

    acc = None
    chat_id = None
    temp_files_to_cleanup = []
    try:
        prompt_text = _build_image_prompt(prompt)
        if ref_image_path:
            temp_files_to_cleanup.append(ref_image_path)

        # 构建 files 参数（如果有参考图）
        files = None
        if ref_image_path:
            files = [{"path": ref_image_path}]

        event_payloads: list[str] = []
        async for item in client.chat_stream_events_with_retry(
            model, prompt_text, has_custom_tools=False, mode="image", aspect_ratio=ratio, files=files,
        ):
            if item.get("type") == "meta":
                acc = item.get("acc")
                chat_id = item.get("chat_id")
                continue
            if item.get("type") != "event":
                continue
            event_payloads.append(json.dumps(item.get("event", {}), ensure_ascii=False))

        if acc is None or chat_id is None:
            raise HTTPException(status_code=500, detail="Image generation session was not created")

        # 判断是否匿名
        if isinstance(acc, dict):
            acc_token = acc.get("token", "")
        else:
            acc_token = getattr(acc, "token", "")
        is_anonymous = acc_token == "anonymous"

        answer_text = "\n".join(event_payloads)

        # 非匿名模式尝试从 list_chats 获取更多图片信息
        if not is_anonymous:
            try:
                chats = await client.list_chats(acc.token, limit=20)
                current_chat = next((c for c in chats if isinstance(c, dict) and c.get("id") == chat_id), None)
                if current_chat:
                    answer_text += "\n" + json.dumps(current_chat, ensure_ascii=False)
            except Exception as e:
                log.warning(f"[T2I] list_chats 失败（可能是匿名模式）: {e}")

        image_urls = _extract_image_urls(answer_text)
        log.info(f"[T2I] 首次提取到 {len(image_urls)} 张图片 URL")

        # 匿名模式 n>1：并发补充生成
        if is_anonymous and n > 1 and len(image_urls) < n:
            need = n - len(image_urls)
            log.info(f"[T2I] 匿名并发补充生成 {need} 张图片 (ratio={ratio})")
            extra_urls = await asyncio.gather(
                *[_generate_one_anonymous(prompt, ratio, ref_image_path) for _ in range(need)]
            )
            for u in extra_urls:
                if u and u not in image_urls:
                    image_urls.append(u)

        if not image_urls:
            raise HTTPException(status_code=500, detail="Image generation succeeded but no URL found")

        data = [{"url": url, "revised_prompt": prompt} for url in image_urls[:n]]
        return JSONResponse({"created": int(time.time()), "data": data})

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"[T2I] 生成失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 清理临时文件
        for temp_file in temp_files_to_cleanup:
            try:
                Path(temp_file).unlink(missing_ok=True)
                log.debug(f"[T2I] 清理临时文件: {temp_file}")
            except Exception:
                pass

        if acc is not None:
            # 匿名模式的 acc 是 dict，不需要 release；Account 对象才需要
            if not isinstance(acc, dict):
                client.account_pool.release(acc)
                if chat_id:
                    asyncio.create_task(client.delete_chat(acc.token, chat_id))
