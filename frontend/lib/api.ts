const V1 = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1`

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${V1}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || `HTTP ${res.status}`) }
  return res.json()
}

async function reqForm<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(`${V1}${path}`, { method: 'POST', body: formData })
  if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || `HTTP ${res.status}`) }
  return res.json()
}

async function reqBlob(path: string, opts?: RequestInit): Promise<Blob> {
  const res = await fetch(`${V1}${path}`, opts)
  if (!res.ok) {
    const e = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(e.detail || `HTTP ${res.status}`)
  }
  return res.blob()
}

export const api = {
  getConversations: (search?: string) => req<{ conversations: import('./types').Conversation[]; total: number }>(
    `/conversations?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getConversation:  (id: string) => req<{ id: string; title?: string; model: string; messages: import('./types').Message[] }>(`/conversations/${id}`),
  renameConversation: (id: string, title: string) => req<{ id: string; title: string }>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) }),
  deleteConversation: (id: string) => req<{ deleted: boolean }>(`/conversations/${id}`, { method: 'DELETE' }),
  getModels: () => req<{ providers: import('./types').Provider[] }>('/models'),
  chatStream: (body: { message: string; conversation_id?: string; model: string; collection_ids?: string[]; options?: import('./types').ChatOptions }) =>
    fetch(`${V1}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: JSON.stringify({ ...body, stream: true }) }),
  transcribeVoice: (audio: Blob, language?: string) => {
    const formData = new FormData()
    formData.append('audio', audio, 'recording.webm')
    if (language) formData.append('language', language)
    return reqForm<{ text: string; language?: string; duration_s?: number; confidence?: number; segments?: { start: number; end: number; text: string }[] }>(
      '/voice/transcribe',
      formData,
    )
  },
  synthesizeVoice: (body: { text: string; voice?: string; rate?: string; pitch?: string }) =>
    reqBlob('/voice/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: body.text,
        voice: body.voice ?? 'en-US-AriaNeural',
        rate: body.rate ?? '+0%',
        pitch: body.pitch ?? '+0Hz',
      }),
    }),
}
