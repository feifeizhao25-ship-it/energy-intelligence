"use client";

import { useState, useEffect, use } from "react";
import {
    Download,
    Star,
    Share2,
    GitFork,
    Play,
    ArrowLeft,
    TrendingUp,
    Users,
} from "lucide-react";
import Link from "next/link";

interface AgentDetail {
    id: string;
    agentId: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    status: string;
    apiBase: string;
    createdAt: string;
    creator?: {
        name: string;
        profile?: { username: string };
    };
    stats?: {
        installCount: number;
        runCount: number;
        ratingAvg: number;
        ratingCount: number;
        trendingScore: number;
    };
}

export default function AgentDetailPage({
    params,
}: {
    params: Promise<{ agentId: string }>;
}) {
    const resolvedParams = use(params);
    const [agent, setAgent] = useState<AgentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [installed, setInstalled] = useState(false);
    const [shareUrl, setShareUrl] = useState("");

    useEffect(() => {
        fetchAgent();
    }, [resolvedParams.agentId]);

    const fetchAgent = async () => {
        try {
            const res = await fetch(`/api/agent/${resolvedParams.agentId}`);
            const data = await res.json();
            setAgent(data.agent);
        } catch {
            console.error("Failed to fetch agent");
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async () => {
        if (!agent) return;
        try {
            await fetch("/api/agent/install", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agentId: agent.agentId }),
            });
            setInstalled(!installed);
        } catch {
            console.error("Install failed");
        }
    };

    const handleShare = async () => {
        if (!agent) return;
        try {
            const res = await fetch("/api/agent/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agentId: agent.agentId }),
            });
            const data = await res.json();
            setShareUrl(data.shareUrl);
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(data.shareUrl);
            }
        } catch {
            console.error("Share failed");
        }
    };

    if (loading) {
        return (
            <div className="page-container">
                <div className="skeleton" style={{ height: 400, borderRadius: "var(--radius-lg)" }} />
            </div>
        );
    }

    if (!agent) {
        return (
            <div className="page-container">
                <div className="empty-state">
                    <div className="empty-state-icon">🤖</div>
                    <div className="empty-state-text">Agent not found</div>
                    <Link href="/store" className="btn-primary" style={{ marginTop: 16 }}>
                        Back to Store
                    </Link>
                </div>
            </div>
        );
    }

    const stats = agent.stats;

    return (
        <div className="page-container">
            <Link
                href="/store"
                className="btn-ghost"
                style={{ marginBottom: 24, display: "inline-flex" }}
            >
                <ArrowLeft size={16} /> Back to Store
            </Link>

            <div className="animate-fade-in">
                {/* Header */}
                <div
                    className="card"
                    style={{
                        padding: "32px",
                        marginBottom: "24px",
                        background: "var(--gradient-card)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "24px",
                            flexWrap: "wrap",
                        }}
                    >
                        <div
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: "var(--radius-lg)",
                                background: "var(--bg-tertiary)",
                                border: "1px solid var(--border-color)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 40,
                            }}
                        >
                            {agent.icon}
                        </div>

                        <div style={{ flex: 1, minWidth: 240 }}>
                            <h1
                                style={{
                                    fontSize: 28,
                                    fontWeight: 800,
                                    marginBottom: 4,
                                }}
                            >
                                {agent.name}
                            </h1>
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                    marginBottom: "12px",
                                }}
                            >
                                <span className="badge badge-primary">{agent.category}</span>
                                <span className="badge badge-success">
                                    {agent.status}
                                </span>
                                {agent.creator?.profile?.username && (
                                    <Link
                                        href={`/profile/${agent.creator.profile.username}`}
                                        style={{
                                            fontSize: 13,
                                            color: "var(--text-accent)",
                                            textDecoration: "none",
                                        }}
                                    >
                                        @{agent.creator.profile.username}
                                    </Link>
                                )}
                            </div>
                            <p
                                style={{
                                    fontSize: 14,
                                    color: "var(--text-secondary)",
                                    lineHeight: 1.6,
                                    maxWidth: 600,
                                }}
                            >
                                {agent.description}
                            </p>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                gap: "10px",
                                flexWrap: "wrap",
                            }}
                        >
                            <button
                                className={installed ? "btn-secondary" : "btn-primary"}
                                onClick={handleInstall}
                            >
                                <Download size={16} />{" "}
                                {installed ? "Uninstall" : "Install"}
                            </button>
                            <button className="btn-secondary" onClick={handleShare}>
                                <Share2 size={16} /> Share
                            </button>
                            <button className="btn-secondary">
                                <GitFork size={16} /> Fork
                            </button>
                            <Link href="/chat" className="btn-secondary">
                                <Play size={16} /> Try in Chat
                            </Link>
                        </div>
                    </div>

                    {shareUrl && (
                        <div
                            className="animate-fade-in"
                            style={{
                                marginTop: 16,
                                padding: "12px 16px",
                                background: "var(--bg-secondary)",
                                borderRadius: "var(--radius-sm)",
                                fontSize: 13,
                                color: "var(--text-secondary)",
                            }}
                        >
                            ✅ Share link copied: {shareUrl}
                        </div>
                    )}
                </div>

                {/* Stats Grid */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "16px",
                        marginBottom: "24px",
                    }}
                >
                    {[
                        {
                            icon: <Download size={20} />,
                            value: stats?.installCount || 0,
                            label: "Installs",
                        },
                        {
                            icon: <Play size={20} />,
                            value: stats?.runCount || 0,
                            label: "Runs",
                        },
                        {
                            icon: <Star size={20} />,
                            value: stats?.ratingAvg?.toFixed(1) || "—",
                            label: `${stats?.ratingCount || 0} ratings`,
                        },
                        {
                            icon: <TrendingUp size={20} />,
                            value: stats?.trendingScore?.toFixed(1) || "0",
                            label: "Trending Score",
                        },
                    ].map((stat, i) => (
                        <div key={i} className="card" style={{ textAlign: "center" }}>
                            <div
                                style={{
                                    color: "var(--text-accent)",
                                    marginBottom: "8px",
                                    display: "flex",
                                    justifyContent: "center",
                                }}
                            >
                                {stat.icon}
                            </div>
                            <div className="stat-value">
                                {typeof stat.value === "number"
                                    ? stat.value.toLocaleString()
                                    : stat.value}
                            </div>
                            <div className="stat-label">{stat.label}</div>
                        </div>
                    ))}
                </div>

                {/* Agent Protocol Info */}
                <div className="card">
                    <h3
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            marginBottom: 12,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Users size={18} /> FXAP v1 Protocol
                    </h3>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "12px",
                            fontSize: 13,
                        }}
                    >
                        <div>
                            <span style={{ color: "var(--text-tertiary)" }}>Agent ID:</span>{" "}
                            <code
                                style={{
                                    background: "var(--bg-secondary)",
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                }}
                            >
                                {agent.agentId}
                            </code>
                        </div>
                        <div>
                            <span style={{ color: "var(--text-tertiary)" }}>API Base:</span>{" "}
                            <code
                                style={{
                                    background: "var(--bg-secondary)",
                                    padding: "2px 8px",
                                    borderRadius: 4,
                                }}
                            >
                                {agent.apiBase || "N/A"}
                            </code>
                        </div>
                        <div>
                            <span style={{ color: "var(--text-tertiary)" }}>
                                Created:
                            </span>{" "}
                            {new Date(agent.createdAt).toLocaleDateString()}
                        </div>
                        <div>
                            <span style={{ color: "var(--text-tertiary)" }}>
                                Endpoints:
                            </span>{" "}
                            <code style={{ background: "var(--bg-secondary)", padding: "2px 8px", borderRadius: 4 }}>
                                GET /manifest
                            </code>{" "}
                            <code style={{ background: "var(--bg-secondary)", padding: "2px 8px", borderRadius: 4 }}>
                                POST /execute
                            </code>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
