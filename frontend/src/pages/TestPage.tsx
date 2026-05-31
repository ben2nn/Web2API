import { useEffect, useRef, useState, useCallback, type ReactNode } from "react"
import { Button } from "../components/ui/button"
import { Send, RefreshCw, Bot, ImagePlus, X, Wand2, Plus, Paperclip } from "lucide-react"
import { getAuthHeader } from "../lib/auth"
import { API_BASE } from "../lib/api"
import { toast } from "sonner"

// ─── 类型定义 ───────────────────────────────────────────────────────────────

interface AttachedImage {
  file: File
  preview: string       // object URL for display
  base64?: string       // data: URI for sending
}

interface ContentPart {
  type: string
  text?: string
  image_url?: { url: string }
}

type MessageContent = string | ContentPart[]

interface ChatMessage {
  role: string
  content: MessageContent
  reasoning?: string
  error?: boolean
}

interface ImageGenerationResponse {
  data?: { url?: string; revised_prompt?: string }[]
  detail?: unknown
  error?: unknown
}

// ─── 工具函数 ───────────────────────────────────────────────────────────────

/** 压缩图片到合理大小，返回 data: URI */
async function compressImage(file: File, maxDim = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")
      if (!ctx) { reject(new Error("Canvas not supported")); return }
      ctx.drawImage(img, 0, 0, width, height)
      const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg"
      resolve(canvas.toDataURL(mimeType, quality))
    }
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = URL.createObjectURL(file)
  })
}

/** 从消息内容中提取纯文本 */
function extractText(content: MessageContent): string {
  if (typeof content === "string") return content
  return content.filter(p => p.type === "text").map(p => p.text || "").join("")
}

/** 从消息内容中提取图片 URL 列表 */
function extractImageUrls(content: MessageContent): string[] {
  if (typeof content === "string") return []
  return content
    .filter(p => p.type === "image_url" && p.image_url?.url)
    .map(p => p.image_url!.url)
}

// ─── 消息内容渲染组件 ──────────────────────────────────────────────────────

function MessageContent({ content }: { content: MessageContent }) {
  const text = extractText(content)
  type Seg = { start: number; end: number; url: string }
  const segs: Seg[] = []
  const fullRe = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s"<>]+\.(?:jpg|jpeg|png|webp|gif)[^\s"<>]*)/gi
  let m: RegExpExecArray | null
  while ((m = fullRe.exec(text)) !== null) {
    segs.push({ start: m.index, end: m.index + m[0].length, url: (m[1] || m[2]) as string })
  }

  if (segs.length === 0) {
    return <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
  }

  const nodes: ReactNode[] = []
  let cursor = 0
  segs.forEach((seg, i) => {
    if (seg.start > cursor) {
      nodes.push(<span key={"t" + i}>{text.slice(cursor, seg.start)}</span>)
    }
    nodes.push(
      <div key={"i" + i} className="my-2">
        <img
          src={seg.url}
          alt="generated"
          className="max-w-full rounded-lg shadow-md border"
          loading="lazy"
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
        />
        <div className="text-xs text-muted-foreground mt-1 break-all font-mono">{seg.url}</div>
      </div>
    )
    cursor = seg.end
  })
  if (cursor < text.length) {
    nodes.push(<span key="tail">{text.slice(cursor)}</span>)
  }
  return <div className="whitespace-pre-wrap leading-relaxed">{nodes}</div>
}

/** 用户消息渲染：支持多模态（文本 + 图片） */
function UserMessageDisplay({ content }: { content: MessageContent }) {
  const images = extractImageUrls(content)
  const text = extractText(content)

  return (
    <div className="space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`attached-${i}`}
              className="max-w-[200px] max-h-[150px] rounded-lg border object-cover cursor-pointer hover:scale-105 transition-transform"
              onClick={() => window.open(url, "_blank")}
            />
          ))}
        </div>
      )}
      {text && <div className="whitespace-pre-wrap leading-relaxed">{text}</div>}
    </div>
  )
}

// ─── 常量 ────────────────────────────────────────────────────────────────────

const ASPECT_RATIOS = [
  { label: "1:1",  value: "1:1"  },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "4:3",  value: "4:3"  },
  { label: "3:4",  value: "3:4"  },
]

type InputMode = "chat" | "image"

// ─── 主页面组件 ─────────────────────────────────────────────────────────────

export default function TestPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [loading, setLoading] = useState(false)
  const [model, setModel] = useState("qwen3.6-plus")
  const [availableModels, setAvailableModels] = useState<string[]>(["qwen3.6-plus"])
  const [stream, setStream] = useState(true)
  const [inputMode, setInputMode] = useState<InputMode>("chat")
  const [imageRatio, setImageRatio] = useState("16:9")
  const [showMenu, setShowMenu] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 挂载时从 /v1/models 拉模型列表
  useEffect(() => {
    (async () => {
      try {
        const headers = getAuthHeader()
        const r = await fetch(`${API_BASE}/v1/models`, { headers })
        if (!r.ok) return
        const j = await r.json()
        const ids = (j?.data || [])
          .map((m: { id?: string }) => m?.id)
          .filter((id: unknown): id is string => typeof id === "string" && !!id)
        if (ids.length) {
          setAvailableModels(ids)
          if (!ids.includes(model)) setModel(ids[0])
        }
      } catch {
        // keep fallback list
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 点击外部关闭菜单
  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showMenu])

  // ─── 图片处理 ──────────────────────────────────────────────────────────

  const addImages = useCallback(async (files: FileList | File[]) => {
    const newImages: AttachedImage[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} 超过 20MB 限制`)
        continue
      }
      const preview = URL.createObjectURL(file)
      try {
        const base64 = await compressImage(file)
        newImages.push({ file, preview, base64 })
      } catch {
        toast.error(`${file.name} 处理失败`)
        URL.revokeObjectURL(preview)
      }
    }
    if (newImages.length) {
      setAttachedImages(prev => [...prev, ...newImages])
    }
  }, [])

  const removeImage = useCallback((index: number) => {
    setAttachedImages(prev => {
      const removed = prev[index]
      if (removed) URL.revokeObjectURL(removed.preview)
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  // 拖拽处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropZoneRef.current?.classList.add("ring-2", "ring-primary/50")
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropZoneRef.current?.classList.remove("ring-2", "ring-primary/50")
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dropZoneRef.current?.classList.remove("ring-2", "ring-primary/50")
    if (e.dataTransfer.files.length) {
      addImages(e.dataTransfer.files)
    }
  }, [addImages])

  // 粘贴处理
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageFiles = items
      .filter(item => item.type.startsWith("image/"))
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null)
    if (imageFiles.length) {
      e.preventDefault()
      addImages(imageFiles)
    }
  }, [addImages])

  // ─── 构建消息内容 ──────────────────────────────────────────────────────

  const buildContentParts = useCallback(async (text: string, images: AttachedImage[]): Promise<MessageContent> => {
    if (images.length === 0) return text
    const parts: ContentPart[] = []
    if (text.trim()) {
      parts.push({ type: "text", text })
    }
    for (const img of images) {
      const dataUri = img.base64 || await compressImage(img.file)
      parts.push({
        type: "image_url",
        image_url: { url: dataUri },
      })
    }
    return parts
  }, [])

  // ─── 发送消息（统一入口，根据 inputMode 分流）──────────────────────────

  const handleSend = async () => {
    const text = input.trim()
    if ((!text && attachedImages.length === 0) || loading) return

    // 图片生成模式
    if (inputMode === "image") {
      await handleImageGenerate(text)
      return
    }

    // 聊天模式
    const content = await buildContentParts(text, attachedImages)
    const userMsg: ChatMessage = { role: "user", content }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setAttachedImages([])
    setLoading(true)

    try {
      const apiMessages = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }))

      if (!stream) {
        const res = await fetch(`${API_BASE}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ model, messages: apiMessages, stream: false })
        })
        const data = await res.json()
        if (data.error) {
          setMessages(prev => [...prev, { role: "assistant", content: `❌ ${data.error}`, error: true }])
        } else if (data.choices?.[0]) {
          setMessages(prev => [...prev, data.choices[0].message])
        } else {
          setMessages(prev => [...prev, { role: "assistant", content: `❌ 未知响应: ${JSON.stringify(data)}`, error: true }])
        }
      } else {
        const res = await fetch(`${API_BASE}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ model, messages: apiMessages, stream: true })
        })

        if (!res.ok) {
          const errText = await res.text()
          setMessages(prev => [...prev, { role: "assistant", content: `❌ HTTP ${res.status}: ${errText}`, error: true }])
          return
        }

        if (!res.body) throw new Error("No response body")

        setMessages(prev => [...prev, { role: "assistant", content: "" }])
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let hasContent = false
        let streamDone = false

        while (!streamDone) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          for (const rawLine of chunk.split("\n")) {
            const line = rawLine.trim()
            if (!line || line.startsWith(":")) continue
            if (line === "data: [DONE]") {
              streamDone = true
              await reader.cancel().catch(() => undefined)
              break
            }
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.error) {
                  setMessages(prev => {
                    const msgs = [...prev]
                    msgs[msgs.length - 1] = { role: "assistant", content: `❌ ${data.error}`, error: true }
                    return msgs
                  })
                  hasContent = true
                  break
                }
                const content: string = data.choices?.[0]?.delta?.content ?? ""
                const reasoning: string = data.choices?.[0]?.delta?.reasoning_content ?? ""
                if (content || reasoning) {
                  hasContent = true
                  setMessages(prev => {
                    const msgs = [...prev]
                    const last = msgs[msgs.length - 1]
                    msgs[msgs.length - 1] = {
                      ...last,
                      content: (typeof last.content === "string" ? last.content : extractText(last.content)) + content,
                      reasoning: (last.reasoning || "") + reasoning,
                    }
                    return msgs
                  })
                }
              } catch { /* skip */ }
            }
          }
        }

        if (!hasContent) {
          setMessages(prev => {
            const msgs = [...prev]
            msgs[msgs.length - 1] = { role: "assistant", content: "❌ 响应为空（账号可能未激活或无可用账号）", error: true }
            return msgs
          })
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知错误"
      toast.error(`网络错误: ${message}`)
      setMessages(prev => [...prev, { role: "assistant", content: `❌ 网络错误: ${message}`, error: true }])
    } finally {
      setLoading(false)
    }
  }

  // ─── 图片生成 ──────────────────────────────────────────────────────────

  const handleImageGenerate = async (prompt: string) => {
    if (!prompt && attachedImages.length === 0) return
    setLoading(true)
    try {
      // 构建请求体
      const requestBody: Record<string, unknown> = {
        model: "dall-e-3",
        prompt: prompt || "根据参考图生成",
        n: 1,
        ratio: imageRatio,
        response_format: "url",
      }

      // 如果有附件，添加到请求中
      if (attachedImages.length > 0) {
        const images: string[] = []
        for (const img of attachedImages) {
          const dataUri = img.base64 || await compressImage(img.file)
          images.push(dataUri)
        }
        requestBody.images = images
      }

      const res = await fetch(`${API_BASE}/v1/images/generations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(requestBody),
      })

      const data = (await res.json()) as ImageGenerationResponse
      if (!res.ok) {
        const detail = data?.detail || data?.error || `HTTP ${res.status}`
        toast.error(`生成失败: ${String(detail).slice(0, 80)}`)
        return
      }

      const urls = (data.data ?? [])
        .map(item => item.url)
        .filter((url): url is string => typeof url === "string" && url.length > 0)

      if (urls.length === 0) {
        toast.error("未返回图片，请重试")
        return
      }

      // 构建用户消息内容（包含参考图）
      let userContent: MessageContent = `🎨 生成图片：${prompt || "根据参考图生成"}`
      if (attachedImages.length > 0) {
        const parts: ContentPart[] = []
        if (prompt) {
          parts.push({ type: "text", text: `🎨 生成图片：${prompt}` })
        } else {
          parts.push({ type: "text", text: "🎨 根据参考图生成" })
        }
        for (const img of attachedImages) {
          const dataUri = img.base64 || await compressImage(img.file)
          parts.push({ type: "image_url", image_url: { url: dataUri } })
        }
        userContent = parts
      }

      setMessages(prev => [
        ...prev,
        { role: "user", content: userContent },
        { role: "assistant", content: urls.map(url => `![generated](${url})`).join("\n") },
      ])
      setInput("")
      setAttachedImages([])
      toast.success(`成功生成 ${urls.length} 张图片`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "网络错误"
      toast.error(`生成失败: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  // ─── 键盘快捷键 ──────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ─── 渲染 ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] space-y-4 max-w-5xl mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files) addImages(e.target.files)
          e.target.value = ""
        }}
      />

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">接口测试</h2>
          <p className="text-muted-foreground">支持文本、图片输入和图片生成。</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 text-sm bg-card border px-3 py-1.5 rounded-md">
            <span className="font-medium text-muted-foreground">模型:</span>
            <select value={model} onChange={e => setModel(e.target.value)} className="bg-transparent font-mono outline-none">
              {availableModels.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
          <div
            className="flex items-center gap-2 text-sm bg-card border px-3 py-1.5 rounded-md cursor-pointer"
            onClick={() => setStream(!stream)}
          >
            <input type="checkbox" checked={stream} onChange={() => {}} className="cursor-pointer" />
            <span className="font-medium">流式传输 (Stream)</span>
          </div>
          <Button variant="outline" onClick={() => setMessages([])}>
            <RefreshCw className="mr-2 h-4 w-4" /> 清空对话
          </Button>
        </div>
      </div>

      <div className="flex-1 rounded-xl border bg-card overflow-hidden flex flex-col shadow-sm">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
              <Bot className="h-12 w-12 text-muted-foreground/30" />
              <div className="text-center space-y-1">
                <p className="text-sm">发送消息以开始测试，支持多模态输入。</p>
                <p className="text-xs text-muted-foreground/60">
                  📎 附加图片 · 🎨 生成图片 · 💬 文本聊天
                </p>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm shadow-sm
                ${msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : msg.error
                    ? "bg-red-500/10 border border-red-500/30 text-red-400"
                    : "bg-muted/30 border text-foreground"}`}>
                {msg.role === "user" ? (
                  <UserMessageDisplay content={msg.content} />
                ) : msg.role === "assistant" && !msg.content && !msg.reasoning && loading ? (
                  <span className="animate-pulse flex items-center gap-2 text-muted-foreground">
                    <Bot className="h-4 w-4" /> 思考中...
                  </span>
                ) : msg.role === "assistant" && !msg.error ? (
                  <div className="space-y-2">
                    {msg.reasoning ? (
                      <details open className="rounded-md border border-dashed border-border/50 bg-muted/20 p-2 text-xs">
                        <summary className="cursor-pointer select-none text-muted-foreground font-mono">
                          💭 思考过程 ({msg.reasoning.length} 字)
                        </summary>
                        <div className="whitespace-pre-wrap leading-relaxed text-muted-foreground mt-2 pl-2 border-l-2 border-border/30">
                          {msg.reasoning}
                        </div>
                      </details>
                    ) : null}
                    {msg.content ? <MessageContent content={msg.content} /> : null}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap leading-relaxed">{extractText(msg.content)}</div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* 统一输入框容器 */}
        <div
          ref={dropZoneRef}
          className={`mx-4 mb-4 rounded-2xl border transition-all ${
            inputMode === "image" ? "border-primary/30 bg-primary/5" : "border-border bg-background"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* 附件预览区域（在输入框内部上方） */}
          {attachedImages.length > 0 && (
            <div className="px-3 pt-3 pb-1">
              <div className="flex flex-wrap gap-2">
                {attachedImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img.preview}
                      alt={`attach-${i}`}
                      className="h-14 w-14 object-cover rounded-lg border"
                    />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* textarea 输入区 */}
          <div className="flex items-end px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              className="flex-1 bg-transparent border-0 outline-none resize-none text-sm py-1 px-1 min-h-[24px] max-h-[120px] placeholder:text-muted-foreground/60"
              placeholder={
                inputMode === "image"
                  ? "描述你想生成的图片..."
                  : attachedImages.length > 0
                    ? "添加说明或直接发送图片..."
                    : "输入消息..."
              }
              disabled={loading}
              style={{ height: 'auto' }}
              onInput={e => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 120) + 'px'
              }}
            />
          </div>

          {/* 底部工具栏 */}
          <div className="flex items-center justify-between px-2 pb-2 pt-0">
            <div className="flex items-center gap-1">
              {/* + 按钮 + 弹出菜单 */}
              <div className="relative" ref={menuRef}>
                <button
                  className={`p-2 rounded-lg transition-colors ${
                    showMenu ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                  onClick={() => setShowMenu(!showMenu)}
                  title="更多操作"
                >
                  <Plus className={`h-4 w-4 transition-transform duration-200 ${showMenu ? "rotate-45" : ""}`} />
                </button>

                {/* 弹出菜单 */}
                {showMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-44 rounded-xl border bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-150">
                    <button
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-foreground hover:bg-muted/60 transition-colors"
                      onClick={() => {
                        setShowMenu(false)
                        fileInputRef.current?.click()
                      }}
                    >
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span>附件上传</span>
                    </button>
                    <div className="border-t border-border/50" />
                    <button
                      className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                        inputMode === "image"
                          ? "text-primary bg-primary/5 hover:bg-primary/10"
                          : "text-foreground hover:bg-muted/60"
                      }`}
                      onClick={() => {
                        setShowMenu(false)
                        setInputMode(inputMode === "chat" ? "image" : "chat")
                      }}
                    >
                      <Wand2 className={`h-4 w-4 ${inputMode === "image" ? "text-primary" : "text-muted-foreground"}`} />
                      <span>图片生成</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 图片模式指示器 + 比例下拉 */}
              {inputMode === "image" && (
                <div className="flex items-center gap-1.5 ml-1">
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary">
                    <Wand2 className="h-3 w-3" />
                    <span className="text-xs font-medium">图片生成</span>
                    <button
                      onClick={() => setInputMode("chat")}
                      className="ml-0.5 p-0.5 rounded hover:bg-primary/20 transition-colors"
                      title="退出图片生成"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <select
                    value={imageRatio}
                    onChange={e => setImageRatio(e.target.value)}
                    className="px-2 py-1 rounded-md bg-primary/10 border-0 text-xs text-primary font-medium outline-none cursor-pointer hover:bg-primary/15 transition-colors"
                    disabled={loading}
                  >
                    {ASPECT_RATIOS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 发送按钮 */}
            <button
              onClick={handleSend}
              disabled={loading || (!input.trim() && attachedImages.length === 0)}
              className={`p-2 rounded-lg transition-all ${
                loading || (!input.trim() && attachedImages.length === 0)
                  ? "text-muted-foreground/40 cursor-not-allowed"
                  : inputMode === "image"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-foreground text-background hover:bg-foreground/90"
              }`}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : inputMode === "image" ? (
                <Wand2 className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
