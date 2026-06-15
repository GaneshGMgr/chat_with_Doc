'use client'
import { useState } from 'react'
import type { Citation } from '@/lib/types'

export default function CitationChip({ citation, index }: { citation: Citation; index: number }) {
  const [hovered, setHovered] = useState(false)
  const isURL = citation.source.startsWith('http')
  let label = isURL ? (() => { try { return new URL(citation.source).hostname.replace('www.','') } catch { return citation.source } })() : citation.source.replace(/^.*[\/\\]/, '')
  const sublabel = citation.page ? `p.${citation.page}` : citation.section ?? null
  const score = Math.round(citation.score * 100)
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer transition-all duration-150"
        style={{ background:'var(--panel)', border:'1px solid var(--border)', fontSize:'11px', fontFamily:"'IBM Plex Mono',monospace", color:'var(--muted)' }}
        title={citation.preview}
      >
        <span style={{ color:'var(--blue)', fontWeight:600 }}>[{index+1}]</span>
        <span className="truncate max-w-[100px]">{label}</span>
        {sublabel && <span style={{ color:'var(--muted2)' }}>{sublabel}</span>}
        <span style={{ color:'var(--muted2)', fontSize:'10px' }}>{score}%</span>
      </button>
      {hovered && citation.preview && (
        <div className="absolute bottom-full left-0 mb-1.5 z-50 w-72 animate-slide-up">
          <div style={{ background:'var(--panel)', border:'1px solid var(--border2)', borderRadius:'10px', padding:'12px', boxShadow:'0 20px 40px rgba(0,0,0,0.5)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--blue)' }} className="truncate">{label}</span>
              {sublabel && <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--muted)', marginLeft:'8px' }}>{sublabel}</span>}
            </div>
            <p style={{ fontSize:'12px', color:'var(--muted)', lineHeight:'1.5' }} className="line-clamp-4">{citation.preview}</p>
          </div>
        </div>
      )}
    </div>
  )
}
