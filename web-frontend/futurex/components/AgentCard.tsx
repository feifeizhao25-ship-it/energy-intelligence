"use client";

import { Star, Download, TrendingUp } from "lucide-react";

interface AgentCardProps {
    agentId: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    installCount?: number;
    runCount?: number;
    ratingAvg?: number;
    trendingScore?: number;
    installed?: boolean;
    onInstall?: (agentId: string) => void;
    onClick?: (agentId: string) => void;
    style?: React.CSSProperties;
    index?: number;
}

export default function AgentCard({
    agentId,
    name,
    description,
    icon,
    category,
    installCount = 0,
    ratingAvg = 0,
    trendingScore = 0,
    installed = false,
    onInstall,
    onClick,
    style,
    index = 0,
}: AgentCardProps) {
    return (
        <div
            className="card animate-fade-in"
            style={{
                cursor: "pointer",
                animationDelay: `${index * 0.05}s`,
                animationFillMode: "backwards",
                ...style,
            }}
            onClick={() => onClick?.(agentId)}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "14px",
                    marginBottom: "14px",
                }}
            >
                <div
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: "var(--radius-md)",
                        background: "var(--gradient-card)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                        flexShrink: 0,
                    }}
                >
                    {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            marginBottom: "2px",
                            color: "var(--text-primary)",
                        }}
                    >
                        {name}
                    </div>
                    <span className="badge badge-primary" style={{ fontSize: 11 }}>
                        {category}
                    </span>
                </div>
            </div>

            <p
                style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    marginBottom: "16px",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                }}
            >
                {description}
            </p>

            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        gap: "16px",
                        fontSize: 12,
                        color: "var(--text-tertiary)",
                    }}
                >
                    <span
                        style={{ display: "flex", alignItems: "center", gap: "4px" }}
                    >
                        <Download size={12} /> {installCount.toLocaleString()}
                    </span>
                    <span
                        style={{ display: "flex", alignItems: "center", gap: "4px" }}
                    >
                        <Star size={12} fill="currentColor" />{" "}
                        {ratingAvg > 0 ? ratingAvg.toFixed(1) : "—"}
                    </span>
                    {trendingScore > 5 && (
                        <span
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                color: "#34d399",
                            }}
                        >
                            <TrendingUp size={12} /> Hot
                        </span>
                    )}
                </div>

                <button
                    className={installed ? "btn-secondary" : "btn-primary"}
                    style={{ padding: "6px 14px", fontSize: 12 }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onInstall?.(agentId);
                    }}
                >
                    {installed ? "Installed" : "Install"}
                </button>
            </div>
        </div>
    );
}
