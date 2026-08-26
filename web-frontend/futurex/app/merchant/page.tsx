"use client";

import { useState } from "react";
import {
    ShoppingBag,
    Wand2,
    CheckCircle,
    AlertCircle,
} from "lucide-react";

export default function MerchantConsolePage() {
    const [formData, setFormData] = useState({
        businessName: "",
        serviceName: "",
        apiEndpoint: "",
        description: "",
        category: "general",
    });
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [generatedManifest, setGeneratedManifest] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Auto-generate agent ID from business name
        const agentId = `merchant.${formData.businessName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")}`;

        // Auto-generate manifest
        const manifest = {
            name: formData.serviceName,
            version: "1.0.0",
            protocol: "FXAP/v1",
            merchant: formData.businessName,
            endpoints: {
                manifest: `${formData.apiEndpoint}/manifest`,
                execute: `${formData.apiEndpoint}/execute`,
            },
            category: formData.category,
        };

        setGeneratedManifest(JSON.stringify(manifest, null, 2));

        try {
            const res = await fetch("/api/agent/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    agentId,
                    name: formData.serviceName,
                    description: formData.description,
                    icon: "🏪",
                    category: formData.category,
                    apiBase: formData.apiEndpoint,
                    authType: "none",
                    manifestJson: JSON.stringify(manifest),
                    visibility: "public",
                    regionScope: "GLOBAL",
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setStatus("success");
                setMessage(
                    `Your agent "${formData.serviceName}" has been submitted for review! You'll be notified once it's approved.`
                );
            } else {
                setStatus("error");
                setMessage(data.error || "Failed to create agent");
            }
        } catch {
            setStatus("error");
            setMessage("Network error. Please try again.");
        }
    };

    return (
        <div className="page-container">
            <h1 className="page-title">Merchant Console</h1>
            <p className="page-subtitle">
                Connect your business to FutureX — no coding required
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
                {/* Simple Form */}
                <div className="card">
                    <h2
                        style={{
                            fontSize: 18,
                            fontWeight: 700,
                            marginBottom: 8,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <ShoppingBag size={20} /> Business Information
                    </h2>
                    <p
                        style={{
                            fontSize: 13,
                            color: "var(--text-secondary)",
                            marginBottom: 20,
                        }}
                    >
                        Fill in your business details and we&#39;ll automatically create an
                        AI agent for your service.
                    </p>

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
                                Business Name
                            </label>
                            <input
                                className="input"
                                placeholder="Acme Inc."
                                value={formData.businessName}
                                onChange={(e) =>
                                    setFormData({ ...formData, businessName: e.target.value })
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
                                Service / Agent Name
                            </label>
                            <input
                                className="input"
                                placeholder="Order Tracking Agent"
                                value={formData.serviceName}
                                onChange={(e) =>
                                    setFormData({ ...formData, serviceName: e.target.value })
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
                                API Endpoint
                            </label>
                            <input
                                className="input"
                                placeholder="https://api.yourbusiness.com"
                                value={formData.apiEndpoint}
                                onChange={(e) =>
                                    setFormData({ ...formData, apiEndpoint: e.target.value })
                                }
                                required
                            />
                            <span
                                style={{
                                    fontSize: 11,
                                    color: "var(--text-tertiary)",
                                    marginTop: 4,
                                    display: "block",
                                }}
                            >
                                Your API must support POST /execute endpoint
                            </span>
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
                                placeholder="Describe what your service does for users..."
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
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
                                <option value="general">General</option>
                                <option value="shopping">Shopping</option>
                                <option value="food">Food & Dining</option>
                                <option value="travel">Travel</option>
                                <option value="health">Health</option>
                                <option value="education">Education</option>
                                <option value="finance">Finance</option>
                            </select>
                        </div>

                        <button className="btn-primary" type="submit" style={{ marginTop: 8 }}>
                            <Wand2 size={16} /> Create Agent Automatically
                        </button>
                    </form>
                </div>

                {/* Preview */}
                <div>
                    <div className="card" style={{ marginBottom: 20 }}>
                        <h2
                            style={{
                                fontSize: 18,
                                fontWeight: 700,
                                marginBottom: 16,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}
                        >
                            <Wand2 size={20} /> How It Works
                        </h2>
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "16px",
                            }}
                        >
                            {[
                                {
                                    step: "1",
                                    title: "Fill in your details",
                                    desc: "Enter your business info and API endpoint",
                                },
                                {
                                    step: "2",
                                    title: "We generate the manifest",
                                    desc: "FXAP v1 manifest is auto-created for you",
                                },
                                {
                                    step: "3",
                                    title: "Review & approve",
                                    desc: "Our team reviews your agent for quality",
                                },
                                {
                                    step: "4",
                                    title: "Go live!",
                                    desc: "Users can discover and use your agent",
                                },
                            ].map((item) => (
                                <div
                                    key={item.step}
                                    style={{
                                        display: "flex",
                                        gap: "12px",
                                        alignItems: "flex-start",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: "50%",
                                            background: "var(--gradient-primary)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: "white",
                                            flexShrink: 0,
                                        }}
                                    >
                                        {item.step}
                                    </div>
                                    <div>
                                        <div
                                            style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}
                                        >
                                            {item.title}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "var(--text-secondary)",
                                            }}
                                        >
                                            {item.desc}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {generatedManifest && (
                        <div className="card animate-fade-in">
                            <h3
                                style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    marginBottom: 12,
                                    color: "var(--text-accent)",
                                }}
                            >
                                Generated Manifest
                            </h3>
                            <pre
                                style={{
                                    fontSize: 11,
                                    color: "var(--text-secondary)",
                                    background: "var(--bg-secondary)",
                                    padding: "12px",
                                    borderRadius: "var(--radius-sm)",
                                    overflow: "auto",
                                    whiteSpace: "pre-wrap",
                                }}
                            >
                                {generatedManifest}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
