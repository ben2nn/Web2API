import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "../components/ui/button"
import { Check, Copy, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { adminRequestErrorMessage, getAuthHeader, getStoredApiKey } from "../lib/auth"
import { API_BASE } from "../lib/api"

function maskKey(key: string) {
  if (key.length <= 14) return "sk-***"
  return `${key.slice(0, 8)}...${key.slice(-6)}`
}

export default function TokensPage() {
  const [keys, setKeys] = useState<string[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const latestKey = useMemo(() => keys[0] || "", [keys])

  const loadKeys = useCallback(() => {
    if (!getStoredApiKey()) {
      setKeys([])
      setLoading(false)
      toast.error("请先到「系统设置」粘贴 ADMIN_KEY 或 data/api_keys.json 中已有 API Key")
      return
    }
    fetch(`${API_BASE}/api/admin/keys`, { headers: getAuthHeader() })
      .then(async res => {
        if (!res.ok) throw new Error(await adminRequestErrorMessage(res))
        return res.json()
      })
      .then(data => setKeys(data.keys || []))
      .catch(err => toast.error(err instanceof Error ? err.message : "刷新失败，请检查会话 Key"))
      .finally(() => setLoading(false))
  }, [])

  const fetchKeys = useCallback(() => {
    setLoading(true)
    loadKeys()
  }, [loadKeys])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const handleGenerate = () => {
    if (!getStoredApiKey()) {
      toast.error("请先到「系统设置」粘贴 ADMIN_KEY 或已有 API Key")
      return
    }
    const id = toast.loading("正在生成新的 API Key...")
    fetch(`${API_BASE}/api/admin/keys`, {
      method: "POST",
      headers: getAuthHeader(),
    }).then(async res => {
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.success("已生成新的 API Key，并复制到剪贴板", { id })
        if (data.key) void copyToClipboard(data.key)
        fetchKeys()
      } else {
        toast.error(await adminRequestErrorMessage(res), { id })
      }
    }).catch(() => toast.error("生成失败，请检查权限", { id }))
  }

  const handleDelete = (key: string) => {
    if (!getStoredApiKey()) {
      toast.error("请先到「系统设置」粘贴 ADMIN_KEY 或已有 API Key")
      return
    }
    const id = toast.loading("正在删除 API Key...")
    fetch(`${API_BASE}/api/admin/keys/${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    }).then(async res => {
      if (res.ok) {
        toast.success("API Key 已删除", { id })
        fetchKeys()
      } else {
        toast.error(await adminRequestErrorMessage(res), { id })
      }
    }).catch(() => toast.error("删除失败", { id }))
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(text)
    window.setTimeout(() => setCopied(null), 1800)
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/75 bg-card/82 p-6 shadow-[var(--shadow-lift)] backdrop-blur-sm">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent/45 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">API Key</div>
            <h2 className="mt-2 text-4xl font-black tracking-tight">API Key 分发</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              管理下游客户端访问 Go 网关的 Bearer Key，适配 OpenAI、Anthropic、Gemini、图片、视频和文件接口。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { fetchKeys(); toast.success("已刷新") }} disabled={loading}>
              <RefreshCw className={`mr-2 size-4 ${loading ? "animate-spin" : ""}`} /> 刷新
            </Button>
            <Button onClick={handleGenerate}>
              <Plus className="mr-2 size-4" /> 生成新 Key
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[28px] border border-white/75 bg-card/82 p-5 shadow-[var(--shadow-soft)]">
          <div className="text-sm text-muted-foreground">下游 Key 数量</div>
          <div className="mt-3 text-4xl font-black">{keys.length}</div>
        </div>
        <div className="rounded-[28px] border border-white/75 bg-card/82 p-5 shadow-[var(--shadow-soft)]">
          <div className="text-sm text-muted-foreground">最新 Key</div>
          <div className="mt-3 truncate font-mono text-xl font-black">{latestKey ? maskKey(latestKey) : "未生成"}</div>
        </div>
        <div className="rounded-[28px] border border-white/75 bg-card/82 p-5 shadow-[var(--shadow-soft)]">
          <div className="text-sm text-muted-foreground">认证方式</div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border bg-accent/70 px-3 py-1 text-sm font-bold text-accent-foreground">
            <ShieldCheck className="size-4" />
            Bearer / x-api-key
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-[30px] border border-white/75 bg-card/86 shadow-[var(--shadow-lift)]">
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/10 px-6 py-5">
          <div>
            <h3 className="text-xl font-black tracking-tight">Key 列表</h3>
            <p className="text-sm text-muted-foreground">Key 默认遮蔽展示，复制时会写入完整值。</p>
          </div>
          <KeyRound className="size-8 text-muted-foreground/30" />
        </div>
        <div className="divide-y divide-border/50">
          {keys.length === 0 ? (
            <div className="grid min-h-72 place-items-center p-8 text-center text-muted-foreground">
              <div>
                <KeyRound className="mx-auto mb-4 size-12 opacity-30" />
                <div className="font-semibold text-foreground">暂无 API Key</div>
                <p className="mt-1 text-sm">点击“生成新 Key”创建下游访问凭证。</p>
              </div>
            </div>
          ) : (
            keys.map((key, index) => (
              <div key={key} className="grid gap-4 px-6 py-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
                <div className="grid size-10 place-items-center rounded-2xl bg-muted font-mono text-sm font-black">{index + 1}</div>
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm font-bold">{maskKey(key)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">完整 Key 不直接明文展示，避免旁观泄露。</div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => void copyToClipboard(key)}>
                    {copied === key ? <Check className="mr-2 size-4 text-emerald-600" /> : <Copy className="mr-2 size-4" />}
                    复制
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(key)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
