"use client";

import { Zap } from "lucide-react";

interface AgentSuggestionProps {
    name: string;
    icon: string;
    description: string;
    category: string;
    onSelect: () => void;
    index?: number;
}

export default function AgentSuggestion({
    name,
    icon,
    description,
    category,
    onSelect,
    index = 0,
}: AgentSuggestionProps) {
    return (
        <div
            className="animate-slide-up"
            style={{
                background: "var(--gradient-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)",
                padding: "14px 16px",
                cursor: "pointer",
                transition: "all 0.3s ease",
                animationDelay: `${index * 0.1}s`,
                animationFillMode: "backwards",
            }}
            onClick={onSelect}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-hover)";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "var(--shadow-glow)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-color)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "6px",
                }}
            >
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span
                    style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                    }}
                >
                    {name}
                </span>
                <span className="badge badge-primary" style={{ fontSize: 10 }}>
                    {category}
                </span>
                <Zap
                    size={14}
                    style={{ color: "var(--accent-tertiary)", marginLeft: "auto" }}
                />
            </div>
            <p
                style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.4,
                }}
            >
                {description}
            </p>
        </div>
    );
}
