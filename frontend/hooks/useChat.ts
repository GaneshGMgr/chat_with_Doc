'use client'
import { useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import type { Message, Citation, ChatOptions } from '@/lib/types'

export type ChatStatus = 'idle' | 'retrieving' | 'reranking' | 'generating' | 'error'

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [pendingCitations, setPendingCitations] = useState<Citation[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const clearMessages = useCallback(() => {
    setMessages([]); setConversationId(null); setStatus('idle')
    setStatusMessage(''); setPendingCitations([]); setError(null)
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    try {
      const d = await api.getConversation(id)
      setMessages(d.messages); setConversationId(id); setStatus('idle'); setError(null)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load') }
  }, [])

  const sendMessage = useCallback(async (text: string, model: string, collectionIds: string[] = [], opts: ChatOptions = {}) => {
    if (!text.trim() || isStreaming) return
    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true); setStatus('retrieving'); setStatusMessage('Searching knowledge base...')
    setPendingCitations([]); setError(null)
    const aid = `streaming_${Date.now()}`
    setMessages(prev => [...prev, { id: aid, role: 'assistant', content: '', model, citations: [], isStreaming: true }])
    try {
      const res = await api.chatStream({ message: text, conversation_id: conversationId ?? undefined, model, collection_ids: collectionIds, options: opts })
      if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || `HTTP ${res.status}`) }
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let buf = '', finalContent = '', finalCitations: Citation[] = [], finalMsgId = aid
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const parts = buf.split('\n\n'); buf = parts.pop() ?? ''
        for (const part of parts) {
          if (!part.trim()) continue
          let eventName = '', dataStr = ''
          for (const line of part.split('\n')) {
            if (line.startsWith('event: ')) eventName = line.slice(7).trim()
            else if (line.startsWith('data: ')) dataStr = line.slice(6).trim()
          }
          if (!dataStr) continue
          let evt: Record<string, unknown>
          try { evt = JSON.parse(dataStr) } catch { continue }
          const t = evt.type as string
          if (t === 'status') {
            setStatus(evt.step as ChatStatus); setStatusMessage(evt.message as string)
          } else if (t === 'citations') {
            finalCitations = evt.chunks as Citation[]; setPendingCitations(finalCitations)
            setMessages(prev => prev.map(m => m.id === aid ? { ...m, citations: finalCitations } : m))
          } else if (t === 'token') {
            finalContent += evt.content as string
            setMessages(prev => prev.map(m => m.id === aid ? { ...m, content: finalContent } : m))
          } else if (t === 'done') {
            finalMsgId = evt.message_id as string
            setMessages(prev => prev.map(m => m.id === aid
              ? { ...m, id: finalMsgId, content: finalContent, model: evt.model_used as string,
                  citations: finalCitations, tokens_used: evt.tokens_used as number,
                  latency_ms: evt.latency_ms as number, isStreaming: false } : m))
          } else if (t === 'error') {
            throw new Error(evt.message as string)
          }
        }
      }
      setStatus('idle'); setStatusMessage(''); setIsStreaming(false)
      setMessages(prev => prev.map(m => m.id === aid || m.id === finalMsgId ? { ...m, isStreaming: false } : m))
    } catch (e: unknown) {
      if ((e as Error).name === 'AbortError') return
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg); setStatus('error'); setIsStreaming(false)
      setMessages(prev => prev.filter(m => m.id !== aid))
    }
  }, [conversationId, isStreaming])

  return { messages, status, statusMessage, pendingCitations, isStreaming, error, conversationId, sendMessage, loadConversation, clearMessages }
}
