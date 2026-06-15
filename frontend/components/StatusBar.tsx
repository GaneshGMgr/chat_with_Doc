'use client'
import type { ChatStatus } from '@/hooks/useChat'

const LABELS: Record<string, string> = { retrieving:'Retrieving docs', reranking:'Re-ranking chunks', generating:'Generating answer' }
const COLORS: Record<string, string> = { retrieving:'#4d9fff', reranking:'#ffb830', generating:'#c8f020' }

export default function StatusBar({ status, message }: { status: ChatStatus; message: string }) {
  if (status === 'idle' || status === 'error') return null
  const color = COLORS[status] ?? '#c8f020'
  return (
    <div className="animate-fade-in flex items-center gap-2 px-4 py-2" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px' }}>
      <span style={{ color }} className="flex items-center gap-1.5">
        {[0,1,2].map(i => (
          <span key={i} className="inline-block w-1 h-1 rounded-full bg-current animate-pulse" style={{ animationDelay:`${i*0.15}s` }} />
        ))}
        {LABELS[status] ?? status}
      </span>
      <span style={{ color: 'var(--muted)' }} className="truncate">{message}</span>
    </div>
  )
}
