import type {
  AttachmentType,
  MediaItem,
  MessageAttachment,
  MessageSegment,
  WidgetConfig,
} from '../types'

export interface HistoryResponseItem {
  id: string
  role: 'user' | 'assistant' | 'operator'
  content: string
  operatorName?: string
  createdAt: string
  media?: MediaItem[]
  segments?: MessageSegment[]
  attachments?: MessageAttachment[]
}

export interface UploadResult {
  url: string
  type: AttachmentType
  mimeType: string
}

export interface HistoryResponse {
  items: HistoryResponseItem[]
  hasMore: boolean
}

const configCache = new Map<string, WidgetConfig>()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The API validates visitorId with @IsUUID(), and `crypto.randomUUID` only
 *  exists in a secure context — on a plain http:// host page it is undefined.
 *  So build the UUIDv4 by hand there; `getRandomValues` is available in both
 *  contexts and only falls back to Math.random on ancient browsers. */
function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10x

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function getOrCreateVisitorId(token: string): string {
  const key = `vo_visitor_${token}`
  const stored = localStorage.getItem(key)
  // Widgets released before the fix persisted a non-UUID id, which the API
  // rejects with 400 forever — reissue instead of honouring it.
  if (stored && UUID_RE.test(stored)) return stored

  const id = randomUuid()
  localStorage.setItem(key, id)
  return id
}

export class WidgetApiClient {
  readonly visitorId: string

  constructor(
    private baseUrl: string,
    private token: string,
  ) {
    this.visitorId = getOrCreateVisitorId(token)
  }

  async getConfig(): Promise<WidgetConfig> {
    const cached = configCache.get(this.token)
    if (cached) return cached

    const res = await fetch(`${this.baseUrl}/widget/config/${this.token}`)
    if (!res.ok) throw new Error(`Failed to load config: ${res.status}`)
    const config: WidgetConfig = await res.json()
    configCache.set(this.token, config)
    return config
  }

  /** Replaces the cached config so subsequent reads see the fresh value.
   *  Used when the gateway pushes a `config_updated` event. */
  primeConfigCache(config: WidgetConfig) {
    configCache.set(this.token, config)
  }

  async getHistory(limit = 50, offset = 0): Promise<HistoryResponse> {
    const params = new URLSearchParams({
      token: this.token,
      visitorId: this.visitorId,
      limit: String(limit),
      offset: String(offset),
    })
    const res = await fetch(`${this.baseUrl}/widget/messages?${params}`)
    if (!res.ok) throw new Error(`Failed to load history: ${res.status}`)
    return res.json()
  }

  async createSession(): Promise<{ sessionId: string }> {
    const res = await fetch(`${this.baseUrl}/widget/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: this.token, visitorId: this.visitorId }),
    })
    if (!res.ok) throw new Error(`Failed to create session: ${res.status}`)
    return res.json()
  }

  /** Uploads a single visitor file (image/audio/video) and returns the
   *  signed URL the caller then attaches to the next streamMessage() call. */
  async uploadAttachment(file: File | Blob): Promise<UploadResult> {
    const fd = new FormData()
    fd.append('token', this.token)
    fd.append('file', file, (file as File).name ?? 'upload')
    const res = await fetch(`${this.baseUrl}/widget/upload`, {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Upload failed: ${res.status} ${text}`)
    }
    return res.json()
  }

  streamMessage(
    message: string,
    onToken: (token: string) => void,
    onDone: () => void,
    onHandoff: () => void,
    onError: (err: Error) => void,
    onMedia?: (media: MediaItem[], segments: MessageSegment[]) => void,
    attachments?: MessageAttachment[],
  ): () => void {
    const params = new URLSearchParams({
      token: this.token,
      visitorId: this.visitorId,
      message: encodeURIComponent(message),
    })
    if (attachments?.length) {
      // Backend SSE DTO @Transform-parses this back into an array.
      params.set('attachments', JSON.stringify(attachments))
    }
    const url = `${this.baseUrl}/widget/message/stream?${params}`
    const es = new EventSource(url)

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.token !== undefined) onToken(data.token)
        else if (data.kind === 'media' && Array.isArray(data.segments)) {
          onMedia?.(data.media ?? [], data.segments)
        } else if (data.kind === 'handoff') {
          // The handoff text itself already streamed as tokens; this only marks
          // that a human took over. The stream still finishes with `done`.
          onHandoff()
        } else if (data.done) {
          onDone()
          es.close()
        }
      } catch {
        onError(new Error('Failed to parse SSE data'))
        es.close()
      }
    }

    es.onerror = () => {
      onError(new Error('SSE connection error'))
      es.close()
    }

    return () => es.close()
  }
}
