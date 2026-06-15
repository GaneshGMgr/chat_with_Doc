'use client'
import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => string
  dismiss: (id: string) => void
}

// ── Context ────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Icons ──────────────────────────────────────────────────────────────────
function ToastIcon({ type }: { type: ToastType }) {
  if (type === 'success') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="rgba(45,232,122,0.15)" stroke="rgba(45,232,122,0.6)" strokeWidth="1"/>
      <path d="M5 8l2.5 2.5 3.5-4" stroke="#2de87a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  if (type === 'error') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="rgba(255,94,94,0.15)" stroke="rgba(255,94,94,0.6)" strokeWidth="1"/>
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#ff5e5e" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  if (type === 'warning') return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="rgba(255,184,48,0.15)" stroke="rgba(255,184,48,0.6)" strokeWidth="1"/>
      <path d="M8 5v4M8 11v.5" stroke="#ffb830" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="rgba(77,159,255,0.15)" stroke="rgba(77,159,255,0.6)" strokeWidth="1"/>
      <path d="M8 7v4M8 5v.5" stroke="#4d9fff" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

const TOAST_COLORS: Record<ToastType, { border: string; title: string }> = {
  success: { border: 'rgba(45,232,122,0.25)',  title: '#2de87a' },
  error:   { border: 'rgba(255,94,94,0.25)',   title: '#ff5e5e' },
  warning: { border: 'rgba(255,184,48,0.25)',  title: '#ffb830' },
  info:    { border: 'rgba(77,159,255,0.25)',  title: '#4d9fff' },
}

// ── Single Toast Item ──────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const colors = TOAST_COLORS[toast.type]

  useEffect(() => {
    // Enter
    const t1 = setTimeout(() => setVisible(true), 10)
    // Auto-dismiss
    const dur = toast.duration ?? 4000
    if (dur > 0) {
      const t2 = setTimeout(() => {
        setLeaving(true)
        setTimeout(onDismiss, 300)
      }, dur)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
    return () => clearTimeout(t1)
  }, [toast.duration, onDismiss])

  const handleClick = () => {
    setLeaving(true)
    setTimeout(onDismiss, 300)
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        background: '#13141c',
        border: `1px solid ${colors.border}`,
        borderRadius: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
        cursor: 'pointer',
        minWidth: '280px',
        maxWidth: '360px',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        opacity: visible && !leaving ? 1 : 0,
        transform: visible && !leaving ? 'translateX(0) scale(1)' : 'translateX(20px) scale(0.96)',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: '1px' }}>
        <ToastIcon type={toast.type} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '12px',
          fontWeight: 600,
          color: colors.title,
          marginBottom: toast.message ? '3px' : 0,
        }}>
          {toast.title}
        </p>
        {toast.message && (
          <p style={{ fontSize: '12px', color: '#5a5b6e', lineHeight: '1.5', fontFamily: "'DM Sans', sans-serif" }}>
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); setLeaving(true); setTimeout(onDismiss, 300) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a3b4e', padding: '2px', flexShrink: 0 }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

// ── Provider ────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counterRef = useRef(0)

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = `toast_${Date.now()}_${++counterRef.current}`
    setToasts(prev => [...prev, { ...opts, id }])
    return id
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      {/* Portal-style fixed container */}
      <div style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '8px',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'all' }}>
            <ToastItem toast={t} onDismiss={() => dismiss(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
