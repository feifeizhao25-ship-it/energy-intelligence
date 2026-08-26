"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter } from "lucide-react";
import AgentCard from "@/components/AgentCard";

interface Agent {
    agentId: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    installCount: number;
    runCount: number;
    ratingAvg: number;
    trendingScore: number;
    installed?: boolean;
}

const categories = [
    "all",
    "distribution",
    "energy",
    "health",
    "productivity",
    "creative",
    "analytics",
    "developer",
    "lifestyle",
];

export default function StorePage() {
    const router = useRouter();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAgents();
    }, [category]);

    const fetchAgents = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (category !== "all") params.set("category", category);
            if (search) params.set("q", search);

            const res = await fetch(`/api/feed?${params}`);
            const data = await res.json();
            setAgents(data.agents || []);
        } catch {
            console.error("Failed to fetch agents");
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchAgents();
    };

    const handleInstall = async (agentId: string) => {
        try {
            await fetch("/api/agent/install", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agentId }),
            });
            setAgents((prev) =>
                prev.map((a) =>
                    a.agentId === agentId ? { ...a, installed: !a.installed } : a
                )
            );
        } catch {
            console.error("Install failed");
        }
    };

    return (
        <div className="page-container">
            <h1 className="page-title">Agent Store</h1>
            <p className="page-subtitle">
                Discover powerful AI agents to automate your workflow
            </p>

            {/* Search */}
            <form
                onSubmit={handleSearch}
                style={{
                    display: "flex",
                    gap: "12px",
                    marginBottom: "24px",
                }}
            >
                <div style={{ flex: 1, position: "relative" }}>
                    <Search
                        size={16}
                        style={{
                            position: "absolute",
                            left: "14px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "var(--text-tertiary)",
                        }}
                    />
                    <input
                        className="input"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search agents..."
                        style={{ paddingLeft: "40px" }}
                    />
                </div>
                <button className="btn-secondary" type="submit">
                    <Filter size={16} /> Filter
                </button>
            </form>

            {/* Categories */}
            <div className="tab-bar">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        className={`tab ${category === cat ? "active" : ""}`}
                        onClick={() => setCategory(cat)}
                    >
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                ))}
            </div>

            {/* Agent Grid */}
            {loading ? (
                <div className="agent-grid">
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className="skeleton"
                            style={{
                                height: 200,
                                borderRadius: "var(--radius-lg)",
                            }}
                        />
                    ))}
                </div>
            ) : agents.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <div className="empty-state-text">
                        No agents found. Try a different search or category.
                    </div>
                </div>
            ) : (
                <div className="agent-grid">
                    {agents.map((agent, i) => (
                        <AgentCard
                            key={agent.agentId}
                            {...agent}
                            index={i}
                            onInstall={handleInstall}
                            onClick={(id) => router.push(`/agent/${id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
