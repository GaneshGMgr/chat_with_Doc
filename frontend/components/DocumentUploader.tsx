'use client'
import { useState, useCallback, useRef, useEffect, DragEvent, ChangeEvent } from 'react'
import { useToast } from './Toast'

// ── Types ───────────────────────────────────────────────────────────────────
export type UploadStage =
  | 'idle'
  | 'uploading'
  | 'queued'
  | 'parsing'
  | 'cleaning'
  | 'chunking'
  | 'embedding'
  | 'storing'
  | 'completed'
  | 'failed'

interface FileUpload {
  id: string
  file: File
  stage: UploadStage
  progress: number      // 0-1
  jobId?: string
  documentId?: string
  chunksCreated?: number
  chunksTotal?: number
  error?: string
  startedAt?: number
}

interface Props {
  apiUrl?: string
  collectionId?: string
  onSuccess?: (documentId: string, filename: string, chunks: number) => void
  onError?: (filename: string, error: string) => void
  maxFileSizeMB?: number
  accept?: string[]
}

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_ACCEPT = ['pdf', 'docx', 'txt', 'md']
const MIME_MAP: Record<string, string> = {
  pdf:  'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt:  'text/plain',
  md:   'text/markdown',
}
const STAGE_LABELS: Record<UploadStage, string> = {
  idle:      '',
  uploading: 'Uploading...',
  queued:    'Queued',
  parsing:   'Parsing text',
  cleaning:  'Cleaning content',
  chunking:  'Splitting into chunks',
  embedding: 'Generating embeddings',
  storing:   'Storing in vector DB',
  completed: 'Indexed successfully',
  failed:    'Failed',
}
const STAGE_PROGRESS: Record<string, number> = {
  parsing:   0.15,
  cleaning:  0.30,
  chunking:  0.50,
  embedding: 0.70,
  storing:   0.88,
  done:      1.0,
}
const STAGE_ORDER: UploadStage[] = ['parsing','cleaning','chunking','embedding','storing','completed']

// ── File type icon ────────────────────────────────────────────────────────────
function FileTypeIcon({ ext }: { ext: string }) {
  const color = ext === 'pdf' ? '#ff5e5e' : ext === 'docx' ? '#4d9fff' : ext === 'md' ? '#c8f020' : '#ffb830'
  return (
    <div style={{
      width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
      background: `${color}15`, border: `1px solid ${color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', fontWeight: 700, color, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
        {ext.slice(0, 3)}
      </span>
    </div>
  )
}

// ── Stage dots progress ────────────────────────────────────────────────────
function StageDots({ stage }: { stage: UploadStage }) {
  const activeIdx = STAGE_ORDER.indexOf(stage)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
      {STAGE_ORDER.slice(0, -1).map((s, i) => {
        const done    = i < activeIdx
        const current = i === activeIdx
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: current ? '8px' : '6px',
              height: current ? '8px' : '6px',
              borderRadius: '50%',
              background: done ? '#2de87a' : current ? '#c8f020' : '#1e1f2e',
              border: current ? '2px solid rgba(200,240,32,0.4)' : done ? '1px solid rgba(45,232,122,0.4)' : '1px solid #252637',
              transition: 'all 0.3s',
              boxShadow: current ? '0 0 8px rgba(200,240,32,0.4)' : 'none',
            }} />
            {i < 4 && <div style={{ width: '12px', height: '1px', background: done ? '#2de87a50' : '#1e1f2e' }} />}
          </div>
        )
      })}
    </div>
  )
}

// ── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ progress, stage }: { progress: number; stage: UploadStage }) {
  const color = stage === 'completed' ? '#2de87a' : stage === 'failed' ? '#ff5e5e' : '#c8f020'
  return (
    <div style={{ height: '3px', background: '#1e1f2e', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${Math.round(progress * 100)}%`,
        background: color,
        borderRadius: '2px',
        transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: stage !== 'completed' && stage !== 'failed' ? `0 0 6px ${color}80` : 'none',
      }} />
    </div>
  )
}

// ── Upload Item ──────────────────────────────────────────────────────────────
function UploadItem({ upload, onRetry, onRemove }: {
  upload: FileUpload
  onRetry: (id: string) => void
  onRemove: (id: string) => void
}) {
  const ext = upload.file.name.split('.').pop()?.toLowerCase() ?? 'txt'
  const sizeStr = upload.file.size > 1024 * 1024
    ? `${(upload.file.size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(upload.file.size / 1024)} KB`
  const elapsed = upload.startedAt ? Math.round((Date.now() - upload.startedAt) / 1000) : 0

  return (
    <div style={{
      background: '#13141c',
      border: `1px solid ${upload.stage === 'failed' ? 'rgba(255,94,94,0.2)' : upload.stage === 'completed' ? 'rgba(45,232,122,0.15)' : '#1e1f2e'}`,
      borderRadius: '10px',
      padding: '12px 14px',
      transition: 'border-color 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <FileTypeIcon ext={ext} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* File name + size */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
            <p style={{
              fontSize: '13px', fontWeight: 500, color: '#ddd8c4',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {upload.file.name}
            </p>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#3a3b4e', flexShrink: 0 }}>
              {sizeStr}
            </span>
          </div>

          {/* Stage label + chunk count */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px',
              color: upload.stage === 'completed' ? '#2de87a' : upload.stage === 'failed' ? '#ff5e5e' : '#5a5b6e',
            }}>
              {STAGE_LABELS[upload.stage]}
            </span>
            {upload.chunksCreated != null && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#3a3b4e' }}>
                {upload.stage === 'completed'
                  ? `${upload.chunksCreated} chunks indexed`
                  : `${upload.chunksCreated}/${upload.chunksTotal ?? '?'} chunks`}
              </span>
            )}
            {upload.stage !== 'completed' && upload.stage !== 'failed' && elapsed > 3 && (
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#3a3b4e' }}>
                {elapsed}s
              </span>
            )}
          </div>

          {/* Progress bar */}
          {upload.stage !== 'idle' && upload.stage !== 'failed' && (
            <ProgressBar progress={upload.progress} stage={upload.stage} />
          )}

          {/* Stage dots (only during processing) */}
          {['parsing','cleaning','chunking','embedding','storing'].includes(upload.stage) && (
            <StageDots stage={upload.stage} />
          )}

          {/* Error message */}
          {upload.stage === 'failed' && upload.error && (
            <p style={{ fontSize: '11px', color: '#ff5e5e80', marginTop: '4px', fontFamily: "'DM Sans', sans-serif" }}>
              {upload.error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {upload.stage === 'failed' && (
            <button onClick={() => onRetry(upload.id)} title="Retry"
              style={{ padding: '5px', background: 'rgba(200,240,32,0.08)', border: '1px solid rgba(200,240,32,0.2)', borderRadius: '6px', cursor: 'pointer', color: '#c8f020' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6a4 4 0 014-4 4 4 0 013.2 1.6L10 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M10 2v2H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M10 6a4 4 0 01-4 4 4 4 0 01-3.2-1.6L2 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M2 10V8h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          {(upload.stage === 'completed' || upload.stage === 'failed') && (
            <button onClick={() => onRemove(upload.id)} title="Remove"
              style={{ padding: '5px', background: 'none', border: '1px solid #1e1f2e', borderRadius: '6px', cursor: 'pointer', color: '#3a3b4e' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function DocumentUploader({
  apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000',
  collectionId,
  onSuccess,
  onError,
  maxFileSizeMB = 50,
  accept = DEFAULT_ACCEPT,
}: Props) {
  const { toast } = useToast()
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [isIngestingUrl, setIsIngestingUrl] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const dragCounter = useRef(0)

  // ── Cleanup polls on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      pollTimers.current.forEach(t => clearTimeout(t))
    }
  }, [])

  // ── Validation ───────────────────────────────────────────────────────────
  const validateFile = useCallback((file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!accept.includes(ext)) {
      return `File type .${ext} not supported. Accepted: ${accept.join(', ')}`
    }
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      return `File too large. Maximum size is ${maxFileSizeMB} MB`
    }
    return null
  }, [accept, maxFileSizeMB])

  // ── Update a specific upload ────────────────────────────────────────────
  const updateUpload = useCallback((id: string, patch: Partial<FileUpload>) => {
    setUploads(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))
  }, [])

  // ── Poll ingestion status ────────────────────────────────────────────────
  const pollStatus = useCallback((uploadId: string, jobId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/v1/ingest/status/${jobId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        // Map backend stage to our UploadStage
        const stageMap: Record<string, UploadStage> = {
          parsing: 'parsing', cleaning: 'cleaning', chunking: 'chunking',
          embedding: 'embedding', storing: 'storing', done: 'completed',
        }
        const mappedStage: UploadStage =
          data.status === 'completed' ? 'completed' :
          data.status === 'failed'    ? 'failed' :
          data.status === 'queued'    ? 'queued' :
          stageMap[data.stage ?? ''] ?? 'processing' as UploadStage

        const progress = data.status === 'completed' ? 1.0 :
          data.progress ?? STAGE_PROGRESS[data.stage ?? ''] ?? 0.1

        updateUpload(uploadId, {
          stage:         mappedStage,
          progress:      progress,
          chunksCreated: data.chunks_created,
          chunksTotal:   data.chunks_total,
          error:         data.error ?? undefined,
        })

        if (data.status === 'completed') {
          pollTimers.current.delete(uploadId)
          // Fetch document name for toast
          const uploadData = await (async () => {
            try {
              const dr = await fetch(`${apiUrl}/api/v1/documents/${data.document_id}`)
              return dr.ok ? await dr.json() : null
            } catch { return null }
          })()
          const name = uploadData?.name ?? jobId
          toast({ type: 'success', title: 'Document indexed!', message: `${name} · ${data.chunks_created} chunks ready` })
          onSuccess?.(data.document_id, name, data.chunks_created)
        } else if (data.status === 'failed') {
          pollTimers.current.delete(uploadId)
          const errMsg = data.error ?? 'Processing failed'
          toast({ type: 'error', title: 'Ingestion failed', message: errMsg })
          onError?.(uploadId, errMsg)
        } else {
          // Keep polling
          const timer = setTimeout(poll, 1500)
          pollTimers.current.set(uploadId, timer)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Network error'
        updateUpload(uploadId, { stage: 'failed', error: msg })
        pollTimers.current.delete(uploadId)
        toast({ type: 'error', title: 'Status check failed', message: msg })
      }
    }
    poll()
  }, [apiUrl, updateUpload, toast, onSuccess, onError])

  // ── Upload a single file ─────────────────────────────────────────────────
  const uploadFile = useCallback(async (upload: FileUpload) => {
    const err = validateFile(upload.file)
    if (err) {
      updateUpload(upload.id, { stage: 'failed', error: err })
      toast({ type: 'error', title: 'Invalid file', message: err })
      onError?.(upload.file.name, err)
      return
    }

    updateUpload(upload.id, { stage: 'uploading', progress: 0.05, startedAt: Date.now() })

    const formData = new FormData()
    formData.append('file', upload.file)
    if (collectionId) formData.append('collection_id', collectionId)

    try {
      const res = await fetch(`${apiUrl}/api/v1/ingest/file`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(errData.detail ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      updateUpload(upload.id, {
        stage: 'queued',
        progress: 0.05,
        jobId: data.job_id,
        documentId: data.document_id,
        chunksTotal: data.estimated_chunks,
      })

      toast({ type: 'info', title: 'Upload received', message: `${upload.file.name} — processing started` })

      // Begin polling
      pollStatus(upload.id, data.job_id)

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      updateUpload(upload.id, { stage: 'failed', error: msg })
      toast({ type: 'error', title: 'Upload failed', message: msg })
      onError?.(upload.file.name, msg)
    }
  }, [apiUrl, collectionId, validateFile, updateUpload, pollStatus, toast, onError])

  // ── Process dropped / selected files ─────────────────────────────────────
  const processFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    const newUploads: FileUpload[] = files.map(file => ({
      id: `up_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file,
      stage: 'idle',
      progress: 0,
    }))
    setUploads(prev => [...newUploads, ...prev])
    newUploads.forEach(u => uploadFile(u))
  }, [uploadFile])

  // ── Drag events ──────────────────────────────────────────────────────────
  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation()
    dragCounter.current++
    setIsDragging(true)
  }
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }
  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation() }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation()
    dragCounter.current = 0; setIsDragging(false)
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files)
  }

  // ── URL ingestion ────────────────────────────────────────────────────────
  const ingestURL = async () => {
    const url = urlInput.trim()
    if (!url) return
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      toast({ type: 'warning', title: 'Invalid URL', message: 'Must start with http:// or https://' })
      return
    }
    setIsIngestingUrl(true)
    try {
      const res = await fetch(`${apiUrl}/api/v1/ingest/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, collection_id: collectionId }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(e.detail ?? `HTTP ${res.status}`)
      }
      const data = await res.json()
      // Create a virtual "file" upload for tracking
      const hostname = (() => { try { return new URL(url).hostname } catch { return url.slice(0,40) } })()
      const fakeFile = new File([], hostname, { type: 'text/plain' })
      const newUpload: FileUpload = {
        id: `up_url_${Date.now()}`,
        file: fakeFile,
        stage: 'queued',
        progress: 0.05,
        jobId: data.job_id,
        documentId: data.document_id,
        startedAt: Date.now(),
      }
      setUploads(prev => [newUpload, ...prev])
      toast({ type: 'info', title: 'URL queued', message: `${hostname} — processing started` })
      pollStatus(newUpload.id, data.job_id)
      setUrlInput('')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to ingest URL'
      toast({ type: 'error', title: 'URL ingestion failed', message: msg })
    } finally {
      setIsIngestingUrl(false)
    }
  }

  // ── Retry / remove ────────────────────────────────────────────────────────
  const retryUpload = (id: string) => {
    const upload = uploads.find(u => u.id === id)
    if (!upload) return
    const fresh: FileUpload = { ...upload, stage: 'idle', progress: 0, error: undefined }
    setUploads(prev => prev.map(u => u.id === id ? fresh : u))
    uploadFile(fresh)
  }
  const removeUpload = (id: string) => {
    const timer = pollTimers.current.get(id)
    if (timer) { clearTimeout(timer); pollTimers.current.delete(id) }
    setUploads(prev => prev.filter(u => u.id !== id))
  }
  const clearCompleted = () => {
    setUploads(prev => prev.filter(u => u.stage !== 'completed'))
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  const active    = uploads.filter(u => !['completed','failed','idle'].includes(u.stage)).length
  const completed = uploads.filter(u => u.stage === 'completed').length
  const failed    = uploads.filter(u => u.stage === 'failed').length
  const acceptAttr = accept.map(ext => MIME_MAP[ext] ?? `.${ext}`).join(',')

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: '#07080d',
      border: '1px solid #1e1f2e',
      borderRadius: '14px',
      overflow: 'hidden',
      fontFamily: "'DM Sans', sans-serif",
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #1e1f2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'rgba(200,240,32,0.08)', border: '1px solid rgba(200,240,32,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M5 7l3 3 3-3" stroke="#c8f020" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12h12" stroke="#c8f020" strokeWidth="1.4" strokeLinecap="round" opacity="0.5"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#ddd8c4', lineHeight: 1 }}>Document Ingestion</p>
            <p style={{ fontSize: '11px', color: '#5a5b6e', fontFamily: "'IBM Plex Mono', monospace", marginTop: '2px' }}>
              {accept.join(' · ').toUpperCase()} · max {maxFileSizeMB}MB
            </p>
          </div>
        </div>
        {/* Stats chips */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {active > 0 && (
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace", background: 'rgba(200,240,32,0.08)', border: '1px solid rgba(200,240,32,0.2)', color: '#c8f020' }}>
              {active} processing
            </span>
          )}
          {completed > 0 && (
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace", background: 'rgba(45,232,122,0.08)', border: '1px solid rgba(45,232,122,0.2)', color: '#2de87a' }}>
              {completed} done
            </span>
          )}
          {failed > 0 && (
            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace", background: 'rgba(255,94,94,0.08)', border: '1px solid rgba(255,94,94,0.2)', color: '#ff5e5e' }}>
              {failed} failed
            </span>
          )}
        </div>
      </div>

      {/* ── Drop zone ──────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 20px' }}>
        <div
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1.5px dashed ${isDragging ? '#c8f020' : '#252637'}`,
            borderRadius: '10px',
            padding: '28px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(200,240,32,0.04)' : 'transparent',
            transition: 'all 0.2s',
            position: 'relative',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptAttr}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (e.target.files?.length) {
                processFiles(e.target.files)
                e.target.value = ''
              }
            }}
            style={{ display: 'none' }}
          />

          {/* Upload icon */}
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: isDragging ? 'rgba(200,240,32,0.12)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isDragging ? 'rgba(200,240,32,0.3)' : '#1e1f2e'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            transition: 'all 0.2s',
            transform: isDragging ? 'scale(1.05) translateY(-2px)' : 'scale(1)',
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 14V4M7 8l4-4 4 4" stroke={isDragging ? '#c8f020' : '#5a5b6e'}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 17h14" stroke={isDragging ? '#c8f020' : '#3a3b4e'}
                strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
              <path d="M2 12v6a1 1 0 001 1h16a1 1 0 001-1v-6" stroke={isDragging ? '#c8f020' : '#3a3b4e'}
                strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
            </svg>
          </div>

          <p style={{ fontSize: '14px', fontWeight: 500, color: isDragging ? '#c8f020' : '#ddd8c4', marginBottom: '4px' }}>
            {isDragging ? 'Drop files here' : 'Drop files or click to browse'}
          </p>
          <p style={{ fontSize: '12px', color: '#5a5b6e', fontFamily: "'IBM Plex Mono', monospace" }}>
            {accept.map(e => `.${e}`).join('  ·  ')}  ·  max {maxFileSizeMB} MB each
          </p>
        </div>
      </div>

      {/* ── URL ingestion ──────────────────────────────────────────────── */}
      <div style={{ padding: '0 20px 16px', borderBottom: uploads.length > 0 ? '1px solid #1e1f2e' : 'none' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#13141c', border: '1px solid #1e1f2e', borderRadius: '8px' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M5.5 7.5A2.5 2.5 0 009 4L8 3a2.5 2.5 0 00-3.5 0L3 4.5" stroke="#5a5b6e" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M7.5 5.5A2.5 2.5 0 004 9l1 1a2.5 2.5 0 003.5 0L10 8.5" stroke="#5a5b6e" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ingestURL()}
              placeholder="https://example.com/article..."
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: '#ddd8c4', width: '100%', fontFamily: "'DM Sans', sans-serif" }}
            />
          </div>
          <button
            onClick={ingestURL}
            disabled={!urlInput.trim() || isIngestingUrl}
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '12px',
              fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, cursor: 'pointer',
              background: urlInput.trim() && !isIngestingUrl ? 'rgba(200,240,32,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${urlInput.trim() && !isIngestingUrl ? 'rgba(200,240,32,0.3)' : '#1e1f2e'}`,
              color: urlInput.trim() && !isIngestingUrl ? '#c8f020' : '#3a3b4e',
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
          >
            {isIngestingUrl ? 'Adding...' : 'Add URL'}
          </button>
        </div>
      </div>

      {/* ── Upload queue ────────────────────────────────────────────────── */}
      {uploads.length > 0 && (
        <div style={{ padding: '12px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', color: '#3a3b4e' }}>
              Queue · {uploads.length}
            </span>
            {completed > 0 && (
              <button onClick={clearCompleted}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#3a3b4e', fontFamily: "'IBM Plex Mono', monospace" }}>
                Clear completed
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
            {uploads.map(u => (
              <UploadItem key={u.id} upload={u} onRetry={retryUpload} onRemove={removeUpload} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
