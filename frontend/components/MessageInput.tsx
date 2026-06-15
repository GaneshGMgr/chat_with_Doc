'use client'
import { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react'
import { api } from '@/lib/api'

export default function MessageInput({ onSend, disabled, placeholder }: { onSend:(t:string)=>void; disabled?:boolean; placeholder?:string }) {
  const [value, setValue] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  useEffect(() => {
    return () => {
      recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [])

  const send = useCallback(() => {
    const t = value.trim()
    if (!t || disabled) return
    onSend(t); setValue('')
    if (ref.current) ref.current.style.height = 'auto'
  }, [value, disabled, onSend])
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send() } }
  const onInput = () => { if (!ref.current) return; ref.current.style.height='auto'; ref.current.style.height=Math.min(ref.current.scrollHeight,160)+'px' }

  const startRecording = useCallback(async () => {
    if (disabled || isTranscribing || isRecording) return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceError('Voice input is not supported in this browser.')
      return
    }

    setVoiceError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        setIsRecording(false)
        setIsTranscribing(true)
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          const result = await api.transcribeVoice(blob)
          const transcript = result.text.trim()
          if (transcript) {
            setValue(transcript)
            onSend(transcript)
            setValue('')
          } else {
            setVoiceError('No speech detected.')
          }
        } catch (error) {
          setVoiceError(error instanceof Error ? error.message : 'Voice transcription failed')
        } finally {
          setIsTranscribing(false)
          stream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          recorderRef.current = null
        }
      }

      streamRef.current = stream
      recorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Microphone access denied')
    }
  }, [disabled, isRecording, isTranscribing, onSend])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  return (
    <div style={{ border:'1px solid var(--border2)', borderRadius:'12px', background:'var(--panel)', transition:'border-color 0.2s', overflow:'hidden' }}
         onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(200,240,32,0.4)'}
         onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'}>
      <textarea ref={ref} value={value} onChange={e=>setValue(e.target.value)} onInput={onInput} onKeyDown={onKey} disabled={disabled} rows={1}
        placeholder={placeholder ?? 'Ask anything about your documents...'}
        style={{ width:'100%', background:'transparent', padding:'12px 16px 8px', fontSize:'14px', color:'var(--text)', resize:'none', outline:'none', fontFamily:"'DM Sans',sans-serif", lineHeight:'1.6', minHeight:'44px', maxHeight:'160px', opacity: disabled ? 0.5 : 1 }} />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px 10px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'4px', minWidth:0 }}>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--muted2)' }}>
            {isTranscribing ? 'Transcribing voice...' : isRecording ? 'Recording...' : value.length > 0 ? `${value.length} chars` : 'Enter · Shift+Enter for newline'}
          </span>
          {voiceError && <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:'10px', color:'var(--red)', maxWidth:'320px' }}>{voiceError}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled || isTranscribing}
            aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
            title={isRecording ? 'Stop recording' : 'Voice input'}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'34px', height:'34px', borderRadius:'8px', border:'1px solid rgba(200,240,32,0.2)', background: isRecording ? 'rgba(255,94,94,0.12)' : 'rgba(200,240,32,0.08)', color: isRecording ? '#ff5e5e' : 'var(--lime)', cursor: (disabled || isTranscribing) ? 'not-allowed' : 'pointer' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              {isRecording ? (
                <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill="currentColor" />
              ) : (
                <>
                  <rect x="5" y="2.5" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M2.5 7a4.5 4.5 0 009 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M7 10.5v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </>
              )}
            </svg>
          </button>
          <button onClick={send} disabled={!value.trim() || disabled || isTranscribing}
            style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 14px', borderRadius:'8px', fontSize:'12px', fontFamily:"'IBM Plex Mono',monospace", fontWeight:'500',
                     background: (!value.trim() || disabled || isTranscribing) ? 'rgba(200,240,32,0.15)' : 'var(--lime)',
                     color: (!value.trim() || disabled || isTranscribing) ? 'rgba(200,240,32,0.4)' : '#07080d',
                     border:'none', cursor: (!value.trim() || disabled || isTranscribing) ? 'not-allowed' : 'pointer', transition:'all 0.15s' }}>
            Send
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
