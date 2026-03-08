import { useEffect, useState } from "react";
import { agentClient } from "./lib/agent-client";

type PingResult = {
  message: string;
  timestamp: number;
};

type ConnectionStatus = "connecting" | "connected" | "error";

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pinging, setPinging] = useState(false);

  useEffect(() => {
    const onReady = () => setStatus("connected");
    window.addEventListener("agent:agent.ready", onReady);

    agentClient.start().catch((err) => {
      console.error("Failed to start agent client:", err);
      setStatus("error");
      setError(String(err));
    });

    return () => {
      window.removeEventListener("agent:agent.ready", onReady);
    };
  }, []);

  const sendPing = async () => {
    setPinging(true);
    setError(null);
    setPingResult(null);

    try {
      const result = await agentClient.request<PingResult>("ping");
      setPingResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="no-select flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold tracking-tight">
        <span style={{ color: "var(--primary)" }}>Open</span>Orchestra
      </h1>

      <div className="flex items-center gap-2 text-sm">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{
            backgroundColor:
              status === "connected"
                ? "#22c55e"
                : status === "connecting"
                  ? "#eab308"
                  : "#ef4444",
          }}
        />
        <span style={{ color: "var(--muted-foreground)" }}>
          Agent: {status}
        </span>
      </div>

      <button
        onClick={sendPing}
        disabled={status !== "connected" || pinging}
        className="rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        style={{
          backgroundColor: "var(--primary)",
          color: "var(--primary-foreground)",
        }}
      >
        {pinging ? "Pinging..." : "Send Ping"}
      </button>

      {pingResult && (
        <div
          className="rounded-md p-4 text-sm"
          style={{
            backgroundColor: "var(--muted)",
            border: "1px solid var(--border)",
          }}
        >
          <p>
            Response:{" "}
            <strong style={{ color: "#22c55e" }}>{pingResult.message}</strong>
          </p>
          <p style={{ color: "var(--muted-foreground)" }}>
            Timestamp: {new Date(pingResult.timestamp).toISOString()}
          </p>
        </div>
      )}

      {error && (
        <div
          className="rounded-md p-4 text-sm"
          style={{
            backgroundColor: "#1c0a0a",
            border: "1px solid #7f1d1d",
            color: "#fca5a5",
          }}
        >
          Error: {error}
        </div>
      )}

      <p
        className="mt-8 text-xs"
        style={{ color: "var(--muted-foreground)" }}
      >
        Phase 0 — IPC Bootstrap Test
      </p>
    </div>
  );
}
