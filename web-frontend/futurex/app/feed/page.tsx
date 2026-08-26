"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Clock, Users } from "lucide-react";
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
}

export default function FeedPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("trending");
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFeed();
    }, [activeTab]);

    const fetchFeed = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/feed?sort=${activeTab}`);
            const data = await res.json();
            setAgents(data.agents || []);
        } catch {
            console.error("Failed to fetch feed");
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async (agentId: string) => {
        try {
            await fetch("/api/agent/install", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agentId }),
            });
            fetchFeed();
        } catch {
            console.error("Install failed");
        }
    };

    const tabs = [
        { id: "trending", label: "Trending", icon: <TrendingUp size={14} /> },
        { id: "new", label: "New", icon: <Clock size={14} /> },
        { id: "popular", label: "Popular", icon: <Users size={14} /> },
    ];

    return (
        <div className="page-container">
            <h1 className="page-title">Feed</h1>
            <p className="page-subtitle">
                Discover what&#39;s hot in the FutureX agent ecosystem
            </p>

            <div className="tab-bar">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`tab ${activeTab === tab.id ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                        style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

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
                    <div className="empty-state-icon">📡</div>
                    <div className="empty-state-text">No agents in your feed yet.</div>
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
