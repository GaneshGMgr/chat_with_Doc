"use client";
import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";
import MessageInput from "@/components/MessageInput";
import ModelSelector from "@/components/ModelSelector";
import StatusBar from "@/components/StatusBar";
import { useChat } from "@/hooks/useChat";
import { useConversations } from "@/hooks/useConversations";

export default function Home() {
  const [model, setModel] = useState("openai:gpt-4o-mini");
  const [activeId, setActiveId] = useState<string | null>(null);
  const {
    messages,
    status,
    statusMessage,
    isStreaming,
    error,
    conversationId,
    sendMessage,
    loadConversation,
    clearMessages,
  } = useChat();
  const {
    conversations,
    search,
    setSearch,
    load,
    rename,
    remove,
    addOrUpdate,
  } = useConversations();

  useEffect(() => {
    if (conversationId && conversationId !== activeId) {
      setActiveId(conversationId);
      addOrUpdate({
        id: conversationId,
        model,
        title: messages[0]?.content?.slice(0, 60),
      });
      load();
    }
  }, [conversationId]);

  const handleNew = useCallback(() => {
    clearMessages();
    setActiveId(null);
  }, [clearMessages]);
  const handleSelect = useCallback(
    async (id: string) => {
      setActiveId(id);
      await loadConversation(id);
    },
    [loadConversation],
  );
  const handleSend = useCallback(
    (t: string) => sendMessage(t, model),
    [sendMessage, model],
  );
  const handleSearch = useCallback(
    (q: string) => {
      setSearch(q);
      load(q || undefined);
    },
    [setSearch, load],
  );

  const currentTitle = conversations.find((c) => c.id === activeId)?.title;

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        overflow: "hidden",
      }}
    >
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
        onRename={rename}
        onDelete={remove}
        search={search}
        onSearch={handleSearch}
      />

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100%",
        }}
      >
        {/* Top bar */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 20px",
            borderBottom: "1px solid var(--border)",
            background: "rgba(7,8,13,0.8)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div>
            {activeId ? (
              <>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--text)",
                    fontFamily: "'DM Sans',sans-serif",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "400px",
                  }}
                >
                  {currentTitle ?? "New conversation"}
                </p>
                {messages.length > 0 && (
                  <p
                    style={{
                      fontSize: "10px",
                      fontFamily: "'IBM Plex Mono',monospace",
                      color: "var(--muted2)",
                    }}
                  >
                    {messages.length} messages
                  </p>
                )}
              </>
            ) : (
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--muted)",
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                New conversation
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Link href="/documents">
              <button
                style={{
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  background: "#13141c",
                  color: "#ddd8c4",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                📄 Documents Uploads
              </button>
            </Link>
            <ModelSelector value={model} onChange={setModel} />
            {isStreaming && (
              <span
                className="animate-pulse"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "11px",
                  fontFamily: "'IBM Plex Mono',monospace",
                  color: "var(--lime)",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "var(--lime)",
                    display: "inline-block",
                  }}
                />
                live
              </span>
            )}
          </div>
        </header>

        <ChatWindow
          messages={messages}
          isStreaming={isStreaming}
          error={error}
          onExample={handleSend}
        />

        {isStreaming && status !== "idle" && (
          <div
            style={{
              maxWidth: "720px",
              margin: "0 auto",
              width: "100%",
              padding: "0 24px",
            }}
          >
            <StatusBar status={status} message={statusMessage} />
          </div>
        )}

        <div
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--bg)",
            padding: "16px 24px",
          }}
        >
          <div style={{ maxWidth: "720px", margin: "0 auto" }}>
            <MessageInput
              onSend={handleSend}
              disabled={isStreaming}
              placeholder={
                isStreaming
                  ? "Generating response..."
                  : "Ask anything about your documents..."
              }
            />
            <p
              style={{
                fontFamily: "'IBM Plex Mono',monospace",
                fontSize: "10px",
                color: "var(--muted2)",
                textAlign: "center",
                marginTop: "8px",
              }}
            >
              Answers grounded in your documents · Citations appear before the
              response
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
