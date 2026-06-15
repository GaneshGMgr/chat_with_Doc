'use client'
import { useEffect, useRef } from 'react'
import MessageItem from './MessageItem'
import type { Message } from '@/lib/types'
import type { ChatStatus } from '@/hooks/useChat'

const EXAMPLES = [
  'Summarize the key findings in my documents',
  'What are the main topics covered?',
  'Find information about a specific subject',
  'Compare sections from different documents',
]

interface Props { messages:Message[]; isStreaming:boolean; error:string|null; onExample:(t:string)=>void; onRegenerate?:(id:string)=>void; }

export default function ChatWindow({ messages,isStreaming,error,onExample,onRegenerate }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollIntoView({ behavior:'smooth' }) }, [messages])

  if (messages.length===0) return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px' }}>
      <div style={{ marginBottom:'32px', textAlign:'center' }}>
        <div style={{ width:'56px', height:'56px', borderRadius:'16px', background:'rgba(200,240,32,0.05)', border:'1px solid rgba(200,240,32,0.15)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
          <svg className="w-7 h-7" style={{ color:'rgba(200,240,32,0.5)' }} viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="3.5" fill="currentColor"/>
            <path d="M14 3v4M14 21v4M3 14h4M21 14h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M6.8 6.8l2.8 2.8M18.4 18.4l2.8 2.8M6.8 21.2l2.8-2.8M18.4 9.6l2.8-2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
          </svg>
        </div>
        <h2 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'18px', color:'var(--text)', marginBottom:'6px' }}>Knowledge Base Ready</h2>
        <p style={{ fontSize:'13px', color:'var(--muted)', maxWidth:'320px', lineHeight:'1.6' }}>Ask questions about your documents. Citations are shown before the answer starts.</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', maxWidth:'480px', width:'100%' }}>
        {EXAMPLES.map((ex,i) => (
          <button key={i} onClick={() => onExample(ex)}
            style={{ textAlign:'left', padding:'12px', borderRadius:'10px', background:'var(--panel)', border:'1px solid var(--border)', cursor:'pointer', fontSize:'12px', color:'var(--muted)', transition:'all 0.15s' }}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='rgba(200,240,32,0.25)';(e.currentTarget as HTMLElement).style.color='var(--text)'}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)';(e.currentTarget as HTMLElement).style.color='var(--muted)'}}>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'rgba(200,240,32,0.4)', display:'block', marginBottom:'4px' }}>{String(i+1).padStart(2,'0')}</span>
            {ex}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'16px 24px' }}>
      <div style={{ maxWidth:'720px', margin:'0 auto' }}>
        {messages.map(m => <MessageItem key={m.id} message={m} onRegenerate={onRegenerate} />)}
        {error && (
          <div className="animate-fade-in" style={{ display:'flex', alignItems:'center', gap:'8px', padding:'12px 16px', borderRadius:'10px', background:'rgba(255,94,94,0.05)', border:'1px solid rgba(255,94,94,0.2)', marginBottom:'16px' }}>
            <svg className="w-4 h-4" style={{ color:'var(--red)', flexShrink:0 }} viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize:'13px', color:'rgba(255,94,94,0.8)' }}>{error}</span>
          </div>
        )}
        <div ref={ref} />
      </div>
    </div>
  )
}
