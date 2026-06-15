# DocumentUploader — Integration Guide

## Files included
- `components/DocumentUploader.tsx` — main upload component
- `components/Toast.tsx`           — self-contained toast system
- `app/documents/page.tsx`         — example usage page

## Installation
1. Copy both component files into your `components/` directory
2. Wrap your app (or just the page) with `<ToastProvider>`

## Basic usage
```tsx
import DocumentUploader from '@/components/DocumentUploader'
import { ToastProvider } from '@/components/Toast'

export default function Page() {
  return (
    <ToastProvider>
      <DocumentUploader
        onSuccess={(docId, name, chunks) => {
          console.log(`Indexed: ${name}, ${chunks} chunks`)
          // Refresh your document list here
        }}
        onError={(filename, error) => {
          console.error(`Failed: ${filename} — ${error}`)
        }}
      />
    </ToastProvider>
  )
}
```

## Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiUrl` | `string` | `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `collectionId` | `string` | `undefined` | Target collection workspace |
| `onSuccess` | `(docId, name, chunks) => void` | — | Called when doc finishes indexing |
| `onError` | `(filename, error) => void` | — | Called on upload/ingest failure |
| `maxFileSizeMB` | `number` | `50` | Max file size in MB |
| `accept` | `string[]` | `['pdf','docx','txt','md']` | Allowed file extensions |

## Features
- Drag-and-drop multi-file upload
- URL web-page ingestion
- Real-time stage tracking: uploading → queued → parsing → embedding → storing → done
- Animated progress bar per file
- Stage dot indicator (5 steps)
- Retry failed uploads
- Auto-dismiss completed items
- Toast notifications (success / error / info / warning)
- Error states: file too large, wrong type, network error, API error

## Toast system (standalone)
```tsx
import { useToast } from '@/components/Toast'

function MyComponent() {
  const { toast, dismiss } = useToast()

  const showSuccess = () => toast({
    type: 'success',
    title: 'Done!',
    message: 'Operation completed successfully',
    duration: 4000,  // ms, 0 = persist until clicked
  })

  // Types: 'success' | 'error' | 'info' | 'warning'
}
```
