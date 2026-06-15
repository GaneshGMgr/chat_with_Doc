export interface Citation {
  chunk_id: string; source: string; page?: number; section?: string; score: number; preview: string;
}
export interface Message {
  id: string; role: 'user' | 'assistant'; content: string; model?: string;
  citations?: Citation[]; tokens_used?: number; latency_ms?: number;
  created_at?: string; isStreaming?: boolean;
}
export type SSEEventType = 'status' | 'citations' | 'token' | 'done' | 'error';
export interface Conversation {
  id: string; title?: string; model: string; message_count: number;
  created_at: string; updated_at: string;
}
export interface ModelInfo { id: string; label: string; ctx?: number; size_gb?: number; }
export interface Provider { id: string; name: string; available: boolean; endpoint?: string; models: ModelInfo[]; }
export interface ChatOptions {
  temperature?: number; max_tokens?: number; top_k_chunks?: number; rerank?: boolean; hybrid_search?: boolean;
}
