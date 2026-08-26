"use client";

import { useState } from "react";
import { Code2, Upload, Send, CheckCircle, AlertCircle } from "lucide-react";

export default function DevConsolePage() {
    const [formData, setFormData] = useState({
        agentId: "",
        name: "",
        description: "",
        icon: "🤖",
        category: "general",
        apiBase: "",
        authType: "none",
        visibility: "public",
        regionScope: "GLOBAL",
    });
    const [manifestJson, setManifestJson] = useState("");
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("idle");

        try {
            const res = await fetch("/api/agent/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    manifestJson: manifestJson || JSON.stringify({
                        name: formData.name,
                        version: "1.0.0",
                        protocol: "FXAP/v1",
                        endpoints: {
                            manifest: `${formData.apiBase}/manifest`,
                            execute: `${formData.apiBase}/execute`,
                        },
                    }),
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setStatus("success");
                setMessage(`Agent "${formData.name}" submitted for review!`);
                setFormData({
                    agentId: "",
                    name: "",
                    description: "",
                    icon: "🤖",
                    category: "general",
                    apiBase: "",
                    authType: "none",
                    visibility: "public",
                    regionScope: "GLOBAL",
                });
                setManifestJson("");
            } else {
                setStatus("error");
                setMessage(data.error || "Failed to create agent");
            }
        } catch {
            setStatus("error");
            setMessage("Network error");
        }
    };

    const categories = [
        "general",
        "distribution",
        "energy",
        "health",
        "productivity",
        "creative",
        "analytics",
        "developer",
        "lifestyle",
    ];

    return (
        <div className="page-container">
            <h1 className="page-title">Developer Console</h1>
            <p className="page-subtitle">
                Create, configure, and publish your AI agents on FutureX
            </p>

            {status !== "idle" && (
                <div
                    className="animate-fade-in"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "14px 18px",
                        borderRadius: "var(--radius-md)",
                        marginBottom: "24px",
                        background:
                            status === "success"
                                ? "rgba(5, 150, 105, 0.1)"
                                : "rgba(220, 38, 38, 0.1)",
                        border: `1px solid ${status === "success" ? "rgba(52, 211, 153, 0.3)" : "rgba(248, 113, 113, 0.3)"}`,
                        color: status === "success" ? "#34d399" : "#f87171",
                        fontSize: 14,
                    }}
                >
                    {status === "success" ? (
                        <CheckCircle size={18} />
                    ) : (
                        <AlertCircle size={18} />
                    )}
                    {message}
                </div>
            )}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "24px",
                }}
            >
                {/* Form */}
                <div className="card">
                    <h2
                        style={{
                            fontSize: 18,
                            fontWeight: 700,
                            marginBottom: 20,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Code2 size={20} /> Create Agent
                    </h2>

                    <form
                        onSubmit={handleSubmit}
                        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
                    >
                        <div>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginBottom: 6,
                                    color: "var(--text-secondary)",
                                }}
                            >
                                Agent ID
                            </label>
                            <input
                                className="input"
                                placeholder="com.yourcompany.agentname"
                                value={formData.agentId}
                                onChange={(e) =>
                                    setFormData({ ...formData, agentId: e.target.value })
                                }
                                required
                            />
                        </div>

                        <div>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginBottom: 6,
                                    color: "var(--text-secondary)",
                                }}
                            >
                                Name
                            </label>
                            <input
                                className="input"
                                placeholder="My Amazing Agent"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                                required
                            />
                        </div>

                        <div>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginBottom: 6,
                                    color: "var(--text-secondary)",
                                }}
                            >
                                Description
                            </label>
                            <textarea
                                className="textarea"
                                placeholder="Describe what your agent does..."
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                required
                            />
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "12px",
                            }}
                        >
                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        marginBottom: 6,
                                        color: "var(--text-secondary)",
                                    }}
                                >
                                    Icon (emoji)
                                </label>
                                <input
                                    className="input"
                                    value={formData.icon}
                                    onChange={(e) =>
                                        setFormData({ ...formData, icon: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        marginBottom: 6,
                                        color: "var(--text-secondary)",
                                    }}
                                >
                                    Category
                                </label>
                                <select
                                    className="select"
                                    value={formData.category}
                                    onChange={(e) =>
                                        setFormData({ ...formData, category: e.target.value })
                                    }
                                    style={{ width: "100%" }}
                                >
                                    {categories.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label
                                style={{
                                    display: "block",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    marginBottom: 6,
                                    color: "var(--text-secondary)",
                                }}
                            >
                                API Base URL
                            </label>
                            <input
                                className="input"
                                placeholder="https://api.youragent.com"
                                value={formData.apiBase}
                                onChange={(e) =>
                                    setFormData({ ...formData, apiBase: e.target.value })
                                }
                            />
                        </div>

                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "12px",
                            }}
                        >
                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        marginBottom: 6,
                                        color: "var(--text-secondary)",
                                    }}
                                >
                                    Auth Type
                                </label>
                                <select
                                    className="select"
                                    value={formData.authType}
                                    onChange={(e) =>
                                        setFormData({ ...formData, authType: e.target.value })
                                    }
                                    style={{ width: "100%" }}
                                >
                                    <option value="none">None</option>
                                    <option value="api_key">API Key</option>
                                    <option value="oauth">OAuth</option>
                                </select>
                            </div>
                            <div>
                                <label
                                    style={{
                                        display: "block",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        marginBottom: 6,
                                        color: "var(--text-secondary)",
                                    }}
                                >
                                    Region Scope
                                </label>
                                <select
                                    className="select"
                                    value={formData.regionScope}
                                    onChange={(e) =>
                                        setFormData({ ...formData, regionScope: e.target.value })
                                    }
                                    style={{ width: "100%" }}
                                >
                                    <option value="GLOBAL">Global</option>
                                    <option value="CN">China (CN)</option>
                                </select>
                            </div>
                        </div>

                        <button className="btn-primary" type="submit" style={{ marginTop: 8 }}>
                            <Send size={16} /> Submit for Review
                        </button>
                    </form>
                </div>

                {/* Manifest Editor */}
                <div className="card">
                    <h2
                        style={{
                            fontSize: 18,
                            fontWeight: 700,
                            marginBottom: 20,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Upload size={20} /> Agent Manifest (optional)
                    </h2>

                    <p
                        style={{
                            fontSize: 13,
                            color: "var(--text-secondary)",
                            marginBottom: 16,
                            lineHeight: 1.6,
                        }}
                    >
                        FXAP v1 manifest JSON. If left empty, a manifest will be
                        auto-generated from your agent configuration.
                    </p>

                    <textarea
                        className="textarea"
                        style={{ minHeight: 300, fontFamily: "monospace", fontSize: 12 }}
                        placeholder={`{
  "name": "My Agent",
  "version": "1.0.0",
  "protocol": "FXAP/v1",
  "endpoints": {
    "manifest": "https://api.example.com/manifest",
    "execute": "https://api.example.com/execute"
  },
  "capabilities": ["text", "data"],
  "auth": { "type": "none" }
}`}
                        value={manifestJson}
                        onChange={(e) => setManifestJson(e.target.value)}
                    />

                    {/* Protocol Info */}
                    <div
                        style={{
                            marginTop: 20,
                            padding: "16px",
                            background: "var(--bg-secondary)",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border-color)",
                        }}
                    >
                        <h3
                            style={{
                                fontSize: 14,
                                fontWeight: 700,
                                marginBottom: 10,
                                color: "var(--text-accent)",
                            }}
                        >
                            FXAP v1 Protocol Requirements
                        </h3>
                        <ul
                            style={{
                                fontSize: 12,
                                color: "var(--text-secondary)",
                                lineHeight: 1.8,
                                listStyle: "none",
                                padding: 0,
                            }}
                        >
                            <li>
                                ✅ <code>GET /manifest</code> — Return agent manifest JSON
                            </li>
                            <li>
                                ✅ <code>POST /execute</code> — Execute agent with input
                            </li>
                            <li>
                                ✅ Return <code>{`{ "output": "...", "data": {...} }`}</code>
                            </li>
                            <li>📖 Docs: futurex.ai/docs/fxap</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
