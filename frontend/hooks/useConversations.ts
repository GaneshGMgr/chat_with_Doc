'use client'
import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'
import type { Conversation } from '@/lib/types'

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async (q?: string) => {
    setLoading(true)
    try { const d = await api.getConversations(q); setConversations(d.conversations) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const rename = useCallback(async (id: string, title: string) => {
    await api.renameConversation(id, title)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
  }, [])

  const remove = useCallback(async (id: string) => {
    await api.deleteConversation(id)
    setConversations(prev => prev.filter(c => c.id !== id))
  }, [])

  const addOrUpdate = useCallback((conv: Partial<Conversation> & { id: string }) => {
    setConversations(prev => {
      const exists = prev.find(c => c.id === conv.id)
      if (exists) return prev.map(c => c.id === conv.id ? { ...c, ...conv } : c)
      const now = new Date().toISOString()
      return [{ message_count: 1, model: '', created_at: now, updated_at: now, ...conv } as Conversation, ...prev]
    })
  }, [])

  return { conversations, loading, search, setSearch, load, rename, remove, addOrUpdate }
}
