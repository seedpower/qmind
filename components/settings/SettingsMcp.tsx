"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Check, Copy, KeyRound, RefreshCw, Trash2 } from "lucide-react";

type KeyStatus = {
  configured: boolean;
  prefix: string | null;
  createdAt: string | null;
  envConfigured: boolean;
};

function mcpSnippet(origin: string, key: string) {
  return JSON.stringify(
    {
      mcpServers: {
        qmind: {
          url: `${origin}/api/mcp`,
          headers: {
            Authorization: `Bearer ${key}`,
          },
        },
      },
    },
    null,
    2,
  );
}

function useOrigin() {
  return useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
}

export default function SettingsMcp() {
  const origin = useOrigin();
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<"key" | "snippet" | null>(null);
  const [confirm, setConfirm] = useState<"rotate" | "revoke" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings/mcp-key");
        if (!res.ok) throw new Error("load failed");
        const next = (await res.json()) as KeyStatus;
        if (!cancelled) {
          setStatus(next);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not load MCP settings.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function rotate() {
    if (status?.configured && confirm !== "rotate") {
      setConfirm("rotate");
      return;
    }
    setPending(true);
    setConfirm(null);
    try {
      const res = await fetch("/api/settings/mcp-key", { method: "POST" });
      if (!res.ok) throw new Error("rotate failed");
      const created = (await res.json()) as {
        key: string;
        prefix: string;
        createdAt: string;
      };
      setRevealedKey(created.key);
      setStatus({
        configured: true,
        prefix: created.prefix,
        createdAt: created.createdAt,
        envConfigured: Boolean(status?.envConfigured),
      });
      setError(null);
    } catch {
      setError("Could not generate an API key.");
    } finally {
      setPending(false);
    }
  }

  async function revoke() {
    if (confirm !== "revoke") {
      setConfirm("revoke");
      return;
    }
    setPending(true);
    setConfirm(null);
    try {
      const res = await fetch("/api/settings/mcp-key", { method: "DELETE" });
      if (!res.ok) throw new Error("revoke failed");
      setRevealedKey(null);
      setStatus({
        configured: false,
        prefix: null,
        createdAt: null,
        envConfigured: Boolean(status?.envConfigured),
      });
      setError(null);
    } catch {
      setError("Could not revoke the API key.");
    } finally {
      setPending(false);
    }
  }

  async function copy(label: "key" | "snippet", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setError("Could not copy to the clipboard.");
    }
  }

  const snippet = useMemo(
    () => mcpSnippet(origin || "https://your-host", revealedKey ?? "<MCP_API_KEY>"),
    [origin, revealedKey],
  );

  return (
    <section>
      <div className="settings-card-head">
        <KeyRound size={18} />
        <div>
          <h2>MCP access</h2>
          <p>Generate an API key so third-party agents can add this workspace.</p>
        </div>
      </div>

      <label className="settings-field">
        <span>Endpoint</span>
        <code>{origin ? `${origin}/api/mcp` : "/api/mcp"}</code>
      </label>

      {status?.configured ? (
        <label className="settings-field">
          <span>Current key</span>
          <code>{revealedKey ?? status.prefix}</code>
        </label>
      ) : (
        <p className="settings-note">
          No key yet. Until you generate one, the MCP endpoint stays open.
        </p>
      )}

      {revealedKey ? (
        <p className="settings-warning">
          Copy this key now. QMind only stores a hash, so it will not be shown again.
        </p>
      ) : null}

      {status?.createdAt ? (
        <p className="settings-meta">
          Created {new Date(status.createdAt).toLocaleString()}
        </p>
      ) : null}

      {status?.envConfigured ? (
        <p className="settings-note">
          A key in <code>MCP_API_KEY</code> is also accepted by the server.
        </p>
      ) : null}

      {error ? <p className="settings-error">{error}</p> : null}

      <div className="settings-actions">
        <button
          type="button"
          className="create-btn"
          onClick={() => void rotate()}
          disabled={pending}
        >
          <RefreshCw size={15} />
          {pending
            ? "Working…"
            : status?.configured
              ? confirm === "rotate"
                ? "Replace key"
                : "Regenerate"
              : "Generate API key"}
        </button>
        {revealedKey ? (
          <button
            type="button"
            className="create-btn ghost"
            onClick={() => void copy("key", revealedKey)}
          >
            {copied === "key" ? <Check size={15} /> : <Copy size={15} />}
            {copied === "key" ? "Copied" : "Copy key"}
          </button>
        ) : null}
        {status?.configured ? (
          <button
            type="button"
            className="create-btn ghost danger"
            onClick={() => void revoke()}
            disabled={pending}
          >
            <Trash2 size={15} />
            {confirm === "revoke" ? "Confirm revoke" : "Revoke"}
          </button>
        ) : null}
      </div>

      <label className="settings-field">
        <span>Cursor / agent config</span>
        <textarea
          className="settings-snippet"
          readOnly
          value={snippet}
          spellCheck={false}
        />
      </label>
      <button
        type="button"
        className="create-btn ghost"
        onClick={() => void copy("snippet", snippet)}
      >
        {copied === "snippet" ? <Check size={15} /> : <Copy size={15} />}
        {copied === "snippet" ? "Copied" : "Copy config"}
      </button>
    </section>
  );
}
