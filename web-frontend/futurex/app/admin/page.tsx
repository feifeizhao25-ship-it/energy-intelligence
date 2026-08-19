"use client";

import { useState, useEffect } from "react";
import { Shield, Check, X, Pause, RefreshCw } from "lucide-react";

interface AdminAgent {
    id: string;
    agentId: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    status: string;
    createdAt: string;
    creator?: { name: string; email: string };
}

export default function AdminPage() {
    const [agents, setAgents] = useState<AdminAgent[]>([]);
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAgents();
    }, [filter]);

    const fetchAgents = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter !== "all") params.set("status", filter);
            const res = await fetch(`/api/admin/agents?${params}`);
            const data = await res.json();
            setAgents(data.agents || []);
        } catch {
            console.error("Failed to fetch agents");
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (agentId: string, status: string) => {
        try {
            await fetch("/api/admin/agents", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agentId, status }),
            });
            fetchAgents();
        } catch {
            console.error("Update failed");
        }
    };

    const statusColors: Record<string, string> = {
        active: "badge-success",
        pending: "badge-warning",
        rejected: "badge-danger",
        suspended: "badge-danger",
    };

    return (
        <div className="page-container">
            <h1 className="page-title">Admin Panel</h1>
            <p className="page-subtitle">Manage agents, users, and platform moderation</p>

            {/* Filter tabs */}
            <div className="tab-bar">
                {["all", "pending", "active", "rejected", "suspended"].map((s) => (
                    <button
                        key={s}
                        className={`tab ${filter === s ? "active" : ""}`}
                        onClick={() => setFilter(s)}
                    >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                ))}
            </div>

            {/* Stats */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "16px",
                    marginBottom: "24px",
                }}
            >
                {[
                    { label: "Total Agents", value: agents.length, icon: "🤖" },
                    {
                        label: "Pending Review",
                        value: agents.filter((a) => a.status === "pending").length,
                        icon: "⏳",
                    },
                    {
                        label: "Active",
                        value: agents.filter((a) => a.status === "active").length,
                        icon: "✅",
                    },
                    {
                        label: "Suspended",
                        value: agents.filter((a) => a.status === "suspended").length,
                        icon: "🚫",
                    },
                ].map((stat, i) => (
                    <div key={i} className="card" style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
                        <div className="stat-value">{stat.value}</div>
                        <div className="stat-label">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Agents Table */}
            {loading ? (
                <div className="skeleton" style={{ height: 400, borderRadius: "var(--radius-lg)" }} />
            ) : agents.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">
                        <Shield size={48} style={{ color: "var(--text-tertiary)" }} />
                    </div>
                    <div className="empty-state-text">No agents to review</div>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 13,
                        }}
                    >
                        <thead>
                            <tr
                                style={{
                                    borderBottom: "1px solid var(--border-color)",
                                    background: "var(--bg-secondary)",
                                }}
                            >
                                {["Agent", "Category", "Creator", "Status", "Actions"].map(
                                    (h) => (
                                        <th
                                            key={h}
                                            style={{
                                                padding: "12px 16px",
                                                textAlign: "left",
                                                fontWeight: 600,
                                                color: "var(--text-secondary)",
                                                fontSize: 12,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.05em",
                                            }}
                                        >
                                            {h}
                                        </th>
                                    )
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {agents.map((agent) => (
                                <tr
                                    key={agent.id}
                                    style={{
                                        borderBottom: "1px solid var(--border-color)",
                                        transition: "background 0.2s",
                                    }}
                                    onMouseEnter={(e) =>
                                    (e.currentTarget.style.background =
                                        "var(--bg-hover)")
                                    }
                                    onMouseLeave={(e) =>
                                        (e.currentTarget.style.background = "transparent")
                                    }
                                >
                                    <td style={{ padding: "14px 16px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <span style={{ fontSize: 20 }}>{agent.icon}</span>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{agent.name}</div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: "var(--text-tertiary)",
                                                    }}
                                                >
                                                    {agent.agentId}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: "14px 16px" }}>
                                        <span className="badge badge-primary">
                                            {agent.category}
                                        </span>
                                    </td>
                                    <td
                                        style={{
                                            padding: "14px 16px",
                                            color: "var(--text-secondary)",
                                        }}
                                    >
                                        {agent.creator?.name || "—"}
                                    </td>
                                    <td style={{ padding: "14px 16px" }}>
                                        <span
                                            className={`badge ${statusColors[agent.status] || "badge-primary"}`}
                                        >
                                            {agent.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: "14px 16px" }}>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            {agent.status !== "active" && (
                                                <button
                                                    className="btn-success"
                                                    style={{
                                                        padding: "4px 10px",
                                                        fontSize: 11,
                                                    }}
                                                    onClick={() =>
                                                        updateStatus(agent.agentId, "active")
                                                    }
                                                    title="Approve"
                                                >
                                                    <Check size={14} />
                                                </button>
                                            )}
                                            {agent.status !== "rejected" && (
                                                <button
                                                    className="btn-danger"
                                                    style={{
                                                        padding: "4px 10px",
                                                        fontSize: 11,
                                                    }}
                                                    onClick={() =>
                                                        updateStatus(agent.agentId, "rejected")
                                                    }
                                                    title="Reject"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                            {agent.status === "active" && (
                                                <button
                                                    className="btn-secondary"
                                                    style={{
                                                        padding: "4px 10px",
                                                        fontSize: 11,
                                                    }}
                                                    onClick={() =>
                                                        updateStatus(agent.agentId, "suspended")
                                                    }
                                                    title="Suspend"
                                                >
                                                    <Pause size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div style={{ marginTop: 16, textAlign: "center" }}>
                <button className="btn-ghost" onClick={fetchAgents}>
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>
        </div>
    );
}
