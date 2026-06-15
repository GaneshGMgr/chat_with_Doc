'use client'
import Link from 'next/link'
import { useState, useCallback } from 'react'
import type { Conversation } from '@/lib/types'

function ago(d: string) {
  const m = Math.floor((Date.now()-new Date(d).getTime())/60000)
  if (m<1) return 'now'; if (m<60) return `${m}m`; const h=Math.floor(m/60); if (h<24) return `${h}h`; return `${Math.floor(h/24)}d`
}

interface Props { conversations:Conversation[]; activeId:string|null; onSelect:(id:string)=>void; onNew:()=>void; onRename:(id:string,t:string)=>void; onDelete:(id:string)=>void; search:string; onSearch:(q:string)=>void; }

export default function Sidebar({ conversations,activeId,onSelect,onNew,onRename,onDelete,search,onSearch }: Props) {
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editVal, setEditVal] = useState('')

  const startEdit = (c: Conversation) => { setEditingId(c.id); setEditVal(c.title??'') }
  const commit = (id: string) => { if (editVal.trim()) onRename(id, editVal.trim()); setEditingId(null) }

  return (
    <aside style={{ width:'256px', flexShrink:0, height:'100%', display:'flex', flexDirection:'column', background:'var(--bg)', borderRight:'1px solid var(--border)' }}>
      {/* Header */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'rgba(200,240,32,0.08)', border:'1px solid rgba(200,240,32,0.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg className="w-3.5 h-3.5" style={{ color:'var(--lime)' }} viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="2.5" fill="currentColor"/>
              <path d="M8 2v3M8 11v3M2 8h3M11 8h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:'15px', letterSpacing:'-0.01em' }}>
            <span style={{ color:'var(--text)' }}>RAG</span><span style={{ color:'var(--lime)' }}>base</span>
          </span>
        </div>
        <button onClick={onNew} title="New chat" style={{ width:'24px', height:'24px', borderRadius:'6px', background:'rgba(200,240,32,0.08)', border:'1px solid rgba(200,240,32,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <svg className="w-3 h-3" style={{ color:'var(--lime)' }} viewBox="0 0 12 12" fill="none">
            <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 10px', background:'var(--panel)', border:'1px solid var(--border)', borderRadius:'8px' }}>
          <svg className="w-3 h-3" style={{ color:'var(--muted)', flexShrink:0 }} viewBox="0 0 12 12" fill="none">
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input type="text" value={search} onChange={e=>onSearch(e.target.value)} placeholder="Search chats..."
            style={{ background:'transparent', border:'none', outline:'none', fontSize:'12px', color:'var(--text)', width:'100%', fontFamily:"'DM Sans',sans-serif" }} />
        </div>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:'auto', padding:'6px 0' }}>
        {conversations.length===0 && (
          <div style={{ padding:'32px 16px', textAlign:'center' }}>
            <p style={{ fontSize:'12px', color:'var(--muted)' }}>No conversations yet</p>
            <p style={{ fontSize:'11px', color:'var(--muted2)', marginTop:'4px' }}>Start a new chat!</p>
          </div>
        )}
        {conversations.map(conv => (
          <div key={conv.id} onClick={() => editingId!==conv.id && onSelect(conv.id)} className="group"
            style={{ position:'relative', padding:'8px 12px', margin:'2px 6px', borderRadius:'8px', cursor:'pointer',
                     background: activeId===conv.id ? 'rgba(200,240,32,0.06)' : 'transparent',
                     border: `1px solid ${activeId===conv.id ? 'rgba(200,240,32,0.18)' : 'transparent'}`,
                     transition:'background 0.1s' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'4px' }}>
              {editingId===conv.id ? (
                <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
                  onBlur={()=>commit(conv.id)}
                  onKeyDown={e=>{if(e.key==='Enter')commit(conv.id);if(e.key==='Escape')setEditingId(null)}}
                  onClick={e=>e.stopPropagation()}
                  style={{ fontSize:'12px', color:'var(--text)', background:'transparent', border:'none', borderBottom:'1px solid rgba(200,240,32,0.5)', outline:'none', width:'100%' }} />
              ) : (
                <span style={{ fontSize:'12px', color: activeId===conv.id ? 'var(--lime)' : 'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'160px' }}>
                  {conv.title ?? 'Untitled'}
                </span>
              )}
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--muted2)', flexShrink:0 }}>{ago(conv.updated_at)}</span>
            </div>
            <div style={{ display:'flex', gap:'8px', marginTop:'3px' }}>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--muted2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{conv.model.split(':').pop()}</span>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--muted2)' }}>{conv.message_count}m</span>
            </div>
            {/* Actions — shown on hover via CSS workaround */}
            <div style={{ position:'absolute', right:'8px', top:'8px', display:'none', gap:'2px' }} className="group-hover-actions">
              <button onClick={e=>{e.stopPropagation();startEdit(conv)}} title="Rename"
                style={{ padding:'3px', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', borderRadius:'3px' }}>
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M1 7.5L7 1.5l1.5 1.5-6 6H1v-1.5z" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={e=>{e.stopPropagation();onDelete(conv.id)}} title="Delete"
                style={{ padding:'3px', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', borderRadius:'3px' }}>
                <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none"><path d="M2 3h6M4 3V2h2v1M4 7V5M6 7V5M3 3l.5 5h3L7 3" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/></svg>
              </button>
            </div>
          </div>
        ))}

        <Link href="/metrics" style={{ textDecoration: 'none' }}>
          <div
            className="group"
            style={{
              position:'relative',
              padding:'8px 12px',
              margin:'2px 6px',
              borderRadius:'8px',
              cursor:'pointer',
              background:'transparent',
              border:'1px solid transparent',
              transition:'background 0.1s'
            }}
          >
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'4px' }}>
              <span style={{ fontSize:'12px', color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'160px', display:'flex', alignItems:'center', gap:'8px' }}>
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" style={{ color:'var(--muted2)', flexShrink:0 }}>
                  <path d="M1.5 10.5h9M2.5 8V6.5M5.5 8V3.5M8.5 8V5M10 10.5V2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Metrics
              </span>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--muted2)', flexShrink:0 }}>stats</span>
            </div>
            <div style={{ display:'flex', gap:'8px', marginTop:'3px' }}>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--muted2)' }}>dashboard</span>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--muted2)' }}>live</span>
            </div>
          </div>
        </Link>
      </div>

      <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', textAlign:'center' }}>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--muted2)' }}>RAGbase v1.0 · self-hosted</span>
      </div>
    </aside>
  )
}
