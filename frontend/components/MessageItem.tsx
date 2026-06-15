'use client'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CitationChip from './CitationChip'
import type { Message } from '@/lib/types'
import { api } from '@/lib/api'

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setOk(true); setTimeout(()=>setOk(false),1500) }}
      title="Copy" style={{ padding:'4px', background:'none', border:'none', cursor:'pointer', color: ok ? 'var(--lime)' : 'var(--muted)', borderRadius:'4px' }}>
      {ok ? (
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      ) : (
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><rect x="4" y="4" width="7" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M3 10V3.5A1.5 1.5 0 014.5 2H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
      )}
    </button>
  )
}

export default function MessageItem({ message, onRegenerate }: { message: Message; onRegenerate?: (id:string)=>void }) {
  const isUser = message.role === 'user'
  const [isSpeaking, setIsSpeaking] = useState(false)

  const speak = async () => {
    if (!message.content.trim() || isSpeaking) return
    setIsSpeaking(true)
    try {
      const blob = await api.synthesizeVoice({ text: message.content })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => URL.revokeObjectURL(url)
      audio.onerror = () => URL.revokeObjectURL(url)
      await audio.play()
    } finally {
      setIsSpeaking(false)
    }
  }
  if (isUser) return (
    <div className="flex justify-end mb-5 animate-fade-in">
      <div style={{ maxWidth:'72%', background:'var(--panel)', border:'1px solid var(--border2)', borderRadius:'16px 16px 4px 16px', padding:'10px 14px', fontSize:'14px', lineHeight:'1.6', color:'var(--text)' }}>
        {message.content}
      </div>
    </div>
  )
  return (
    <div className="mb-7 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <div style={{ width:'18px', height:'18px', borderRadius:'50%', background:'rgba(200,240,32,0.1)', border:'1px solid rgba(200,240,32,0.3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--lime)' }} />
        </div>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'11px', color:'var(--muted)' }}>{message.model?.split(':').slice(1).join(':') ?? 'assistant'}</span>
        {message.latency_ms && <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--muted2)' }}>{message.latency_ms}ms</span>}
      </div>
      {message.citations && message.citations.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'10px' }}>
          {message.citations.map((c,i) => <CitationChip key={c.chunk_id} citation={c} index={i} />)}
        </div>
      )}
      <div className={`prose-rag${message.isStreaming && message.content ? ' cursor-blink' : ''}`}>
        {message.isStreaming && !message.content ? (
          <span className="flex items-center gap-1">
            {[0,1,2].map(i => <span key={i} className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'var(--muted)', animationDelay:`${i*0.15}s` }} />)}
          </span>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        )}
      </div>
      {!message.isStreaming && message.content && (
        <div className="flex items-center gap-1 mt-1.5">
          <CopyBtn text={message.content} />
          <button onClick={speak} disabled={isSpeaking}
            title={isSpeaking ? 'Playing' : 'Read aloud'}
            style={{ padding:'4px', background:'none', border:'none', cursor:isSpeaking ? 'not-allowed' : 'pointer', color:isSpeaking ? 'var(--lime)' : 'var(--muted)', borderRadius:'4px' }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 5.5v3h2l3 3V2.5l-3 3h-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M9.5 4.5a3 3 0 010 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M11.2 2.8a5.5 5.5 0 010 8.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
            </svg>
          </button>
          {onRegenerate && <button onClick={() => onRegenerate(message.id)} title="Regenerate"
            style={{ padding:'4px', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', borderRadius:'4px' }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
              <path d="M2 7a5 5 0 015-5 5 5 0 014 2L12 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M12 2v3h-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 7a5 5 0 01-5 5 5 5 0 01-4-2L2 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M2 12V9h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>}
          {message.tokens_used && <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--muted2)', marginLeft:'2px' }}>{message.tokens_used} tokens</span>}
        </div>
      )}
    </div>
  )
}
