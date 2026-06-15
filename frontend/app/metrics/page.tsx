"use client";

import { useEffect, useState } from "react";

type MetricsApiResponse = {
  trace_count: number;
  metrics: {
    p50: number;
    p95: number;
    p99: number;
    avg_tokens: number;
    avg_cost_usd: number;
    total_cost_usd: number;
    mean_citation_coverage: number;
    pct_fully_grounded: number;
    failure_rate: number;
    total_requests: number;
    failed_requests: number;
  };
  error?: string;
};

type LoadState = {
  data: MetricsApiResponse | null;
  loading: boolean;
  error: string | null;
};

const initialState: LoadState = {
  data: null,
  loading: true,
  error: null,
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPercentFromFraction(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(4)}`;
}

function getHealthColor(kind: "coverage" | "failure" | "neutral", value: number): string {
  if (kind === "coverage") {
    if (value > 0.8) return "var(--lime)";
    if (value > 0.65) return "var(--amber)";
    return "var(--red)";
  }

  if (kind === "failure") {
    if (value < 0.05) return "var(--lime)";
    if (value < 0.12) return "var(--amber)";
    return "var(--red)";
  }

  if (value < 0.05) return "var(--lime)";
  if (value < 0.12) return "var(--amber)";
  return "var(--red)";
}

export default function MetricsPage() {
  const [state, setState] = useState<LoadState>(initialState);

  const fetchMetrics = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const response = await fetch("/api/v1/metrics?last_n=100");
      const payload = (await response.json()) as MetricsApiResponse;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load metrics");
      }

      setState({ data: payload, loading: false, error: null });
    } catch (error) {
      setState({
        data: null,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load metrics",
      });
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const metrics = state.data?.metrics;

  const cards = metrics
    ? [
        {
          title: "Latency",
          subtitle: "P50 / P95",
          value: `${Math.round(metrics.p50)} ms / ${Math.round(metrics.p95)} ms`,
          accent: getHealthColor("neutral", metrics.failure_rate),
        },
        {
          title: "Avg Cost / Request",
          subtitle: `avg ${Math.round(metrics.avg_tokens)} tokens`,
          value: formatCurrency(metrics.avg_cost_usd),
          accent: getHealthColor("neutral", metrics.failure_rate),
        },
        {
          title: "Citation Coverage",
          subtitle: `${Math.round(metrics.pct_fully_grounded * 100)}% fully grounded`,
          value: formatPercent(metrics.mean_citation_coverage),
          accent: getHealthColor("coverage", metrics.mean_citation_coverage),
        },
        {
          title: "Failure Rate",
          subtitle: `${metrics.failed_requests} of ${metrics.total_requests} requests`,
          value: formatPercentFromFraction(metrics.failure_rate),
          accent: getHealthColor("failure", metrics.failure_rate),
        },
      ]
    : [];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px",
        background: "radial-gradient(circle at top, rgba(77,159,255,0.12), transparent 34%), var(--bg)",
        overflowY: "auto",
      }}
    >
      <div style={{ maxWidth: "1180px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginBottom: "24px" }}>
          <div>
            <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)" }}>
              Observability
            </p>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(28px, 4vw, 44px)", lineHeight: 1.05, margin: "8px 0 0", color: "#f5f1e8" }}>
              Metrics Dashboard
            </h1>
          </div>

          <button
            type="button"
            onClick={fetchMetrics}
            style={{
              padding: "10px 14px",
              borderRadius: "12px",
              border: "1px solid var(--border2)",
              background: "rgba(19,20,28,0.96)",
              color: "#f0ece0",
              fontSize: "13px",
              fontFamily: "'DM Sans', sans-serif",
              cursor: "pointer",
              boxShadow: "0 10px 30px rgba(0,0,0,0.24)",
            }}
          >
            Refresh
          </button>
        </div>

        {state.loading && (
          <div style={{ padding: "20px 0", color: "var(--muted)", fontFamily: "'IBM Plex Mono', monospace" }}>
            Loading metrics...
          </div>
        )}

        {state.error && !state.loading && (
          <div
            style={{
              marginBottom: "20px",
              padding: "14px 16px",
              borderRadius: "14px",
              border: "1px solid rgba(255,94,94,0.25)",
              background: "rgba(255,94,94,0.08)",
              color: "#ffb9b9",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {state.error}
          </div>
        )}

        {!state.loading && !state.error && metrics && (
          <>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "18px",
              }}
            >
              {cards.map((card) => (
                <article
                  key={card.title}
                  style={{
                    background: "rgba(255,255,255,0.96)",
                    border: "1px solid rgba(30,31,46,0.12)",
                    borderRadius: "20px",
                    padding: "22px",
                    boxShadow: "0 18px 50px rgba(0,0,0,0.15)",
                    minHeight: "160px",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "11px",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "#6b6c7b",
                      marginBottom: "14px",
                    }}
                  >
                    {card.title}
                  </p>
                  <div
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontSize: "clamp(28px, 3vw, 40px)",
                      lineHeight: 1,
                      color: card.accent,
                      marginBottom: "10px",
                    }}
                  >
                    {card.value}
                  </div>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "15px", color: "#636477" }}>
                    {card.subtitle}
                  </p>
                </article>
              ))}
            </section>

            <p
              style={{
                marginTop: "18px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "11px",
                color: "var(--muted)",
              }}
            >
              Based on last {state.data?.trace_count ?? 0} traces. Refresh to update.
            </p>
          </>
        )}
      </div>
    </main>
  );
}