'use client'
import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import type { Provider } from '@/lib/types'

const P_COLORS: Record<string,string> = { openai:'#c8f020', groq:'#4d9fff', ollama:'#ffb830' }
const P_ICONS: Record<string,string>  = { openai:'O', groq:'G', ollama:'L' }

export default function ModelSelector({ value, onChange }: { value: string; onChange: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const [providers, setProviders] = useState<Provider[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { api.getModels().then(d => setProviders(d.providers)).catch(() => {}) }, [])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const currentLabel = (() => {
    for (const p of providers) { const m = p.models.find(m => m.id === value); if (m) return m.label }
    return value.split(':').pop() ?? value
  })()
  const pid = value.split(':')[0]

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 cursor-pointer transition-colors"
        style={{ padding:'6px 12px', background:'var(--panel)', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'12px', fontFamily:"'IBM Plex Mono',monospace", color:'var(--text)' }}>
        <span style={{ color: P_COLORS[pid]??'var(--muted)', fontWeight:'bold' }}>{P_ICONS[pid]??'?'}</span>
        <span>{currentLabel}</span>
        <svg style={{ transform: open?'rotate(180deg)':'none', transition:'transform 0.15s', color:'var(--muted)' }} className="w-3 h-3" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1.5 right-0 z-50 animate-slide-up overflow-hidden"
          style={{ width:'220px', background:'var(--panel)', border:'1px solid var(--border2)', borderRadius:'10px', boxShadow:'0 20px 40px rgba(0,0,0,0.5)' }}>
          {providers.map(prov => (
            <div key={prov.id}>
              <div style={{ padding:'8px 12px', fontSize:'10px', fontFamily:"'IBM Plex Mono',monospace", fontWeight:'700', letterSpacing:'2px', textTransform:'uppercase', color: P_COLORS[prov.id]??'var(--muted)' }}>
                {prov.name}
              </div>
              {prov.models.map(m => (
                <button key={m.id} onClick={() => { onChange(m.id); setOpen(false) }}
                  className="w-full text-left cursor-pointer transition-colors flex items-center justify-between"
                  style={{ padding:'7px 16px', fontSize:'12px', fontFamily:"'IBM Plex Mono',monospace",
                           color: value===m.id ? 'var(--lime)' : 'var(--muted)',
                           background: value===m.id ? 'rgba(200,240,32,0.05)' : 'transparent' }}>
                  <span>{m.label}</span>
                  {m.ctx && <span style={{ fontSize:'10px', color:'var(--muted2)' }}>{(m.ctx/1000).toFixed(0)}k</span>}
                  {m.size_gb && <span style={{ fontSize:'10px', color:'var(--muted2)' }}>{m.size_gb}GB</span>}
                </button>
              ))}
            </div>
          ))}
          {providers.length===0 && <div style={{ padding:'12px 16px', fontSize:'12px', color:'var(--muted)' }}>Loading models...</div>}
        </div>
      )}
    </div>
  )
}
