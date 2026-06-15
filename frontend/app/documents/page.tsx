'use client'
import Link from 'next/link'
import DocumentUploader from '@/components/DocumentUploader'

export default function DocumentsPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#07080d',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '20px',
            padding: '8px 12px',
            borderRadius: '999px',
            border: '1px solid #1e1f2e',
            background: 'rgba(19,20,28,0.9)',
            color: '#ddd8c4',
            textDecoration: 'none',
            fontSize: '12px',
            fontFamily: "'IBM Plex Mono', monospace",
            transition: 'all 0.15s ease',
          }}
        >
          ← Back to home
        </Link>

        <div style={{ marginBottom: '28px' }}>
          <h1
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: '22px',
              fontWeight: 700,
              color: '#ddd8c4',
              marginBottom: '6px',
            }}
          >
            Document Library
          </h1>
          <p style={{ fontSize: '13px', color: '#5a5b6e' }}>
            Upload files or add URLs to index them in your knowledge base.
            Supported: PDF, DOCX, TXT, Markdown.
          </p>
        </div>

        <DocumentUploader
          onSuccess={(docId, name, chunks) => {
            console.log(`Indexed: ${name} (${chunks} chunks, id: ${docId})`)
          }}
          onError={(file, error) => {
            console.error(`Failed: ${file} — ${error}`)
          }}
        />
      </div>
    </div>
  )
}
