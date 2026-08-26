"use client";

import { useState, useEffect, use } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import AgentCard from "@/components/AgentCard";

interface ProfileData {
    user: {
        id: string;
        name: string;
        email: string;
        region: string;
    };
    profile: {
        username: string;
        avatar: string;
        bio: string;
    };
    agents: Array<{
        agentId: string;
        name: string;
        description: string;
        icon: string;
        category: string;
        installCount: number;
        runCount: number;
        ratingAvg: number;
        trendingScore: number;
    }>;
    followerCount: number;
    followingCount: number;
    isFollowing: boolean;
}

export default function ProfilePage({
    params,
}: {
    params: Promise<{ username: string }>;
}) {
    const resolvedParams = use(params);
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProfile();
    }, [resolvedParams.username]);

    const fetchProfile = async () => {
        try {
            const res = await fetch(`/api/profile/${resolvedParams.username}`);
            const data = await res.json();
            setProfile(data);
        } catch {
            console.error("Failed to fetch profile");
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async () => {
        if (!profile) return;
        try {
            await fetch("/api/follow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetUserId: profile.user.id }),
            });
            setProfile((prev) =>
                prev
                    ? {
                        ...prev,
                        isFollowing: !prev.isFollowing,
                        followerCount: prev.isFollowing
                            ? prev.followerCount - 1
                            : prev.followerCount + 1,
                    }
                    : null
            );
        } catch {
            console.error("Follow failed");
        }
    };

    if (loading) {
        return (
            <div className="page-container">
                <div className="skeleton" style={{ height: 300, borderRadius: "var(--radius-lg)" }} />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="page-container">
                <div className="empty-state">
                    <div className="empty-state-icon">👤</div>
                    <div className="empty-state-text">User not found</div>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container">
            {/* Profile Header */}
            <div
                className="card animate-fade-in"
                style={{
                    padding: "32px",
                    marginBottom: "32px",
                    background: "var(--gradient-card)",
                    textAlign: "center",
                }}
            >
                <div
                    style={{
                        width: 80,
                        height: 80,
                        borderRadius: "50%",
                        background: "var(--gradient-primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 32,
                        fontWeight: 700,
                        color: "white",
                        margin: "0 auto 16px",
                        border: "3px solid var(--accent-primary)",
                    }}
                >
                    {profile.profile.avatar || profile.user.name.charAt(0).toUpperCase()}
                </div>

                <h1
                    style={{
                        fontSize: 24,
                        fontWeight: 800,
                        marginBottom: 4,
                    }}
                >
                    {profile.user.name}
                </h1>

                <div
                    style={{
                        fontSize: 14,
                        color: "var(--text-accent)",
                        marginBottom: 8,
                    }}
                >
                    @{profile.profile.username}
                </div>

                {profile.profile.bio && (
                    <p
                        style={{
                            fontSize: 14,
                            color: "var(--text-secondary)",
                            maxWidth: 400,
                            margin: "0 auto 16px",
                        }}
                    >
                        {profile.profile.bio}
                    </p>
                )}

                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "32px",
                        marginBottom: "20px",
                    }}
                >
                    <div>
                        <div className="stat-value">{profile.followerCount}</div>
                        <div className="stat-label">Followers</div>
                    </div>
                    <div>
                        <div className="stat-value">{profile.followingCount}</div>
                        <div className="stat-label">Following</div>
                    </div>
                    <div>
                        <div className="stat-value">{profile.agents.length}</div>
                        <div className="stat-label">Agents</div>
                    </div>
                </div>

                <button
                    className={profile.isFollowing ? "btn-secondary" : "btn-primary"}
                    onClick={handleFollow}
                >
                    {profile.isFollowing ? (
                        <>
                            <UserCheck size={16} /> Following
                        </>
                    ) : (
                        <>
                            <UserPlus size={16} /> Follow
                        </>
                    )}
                </button>
            </div>

            {/* User's Agents */}
            <h2
                style={{
                    fontSize: 18,
                    fontWeight: 700,
                    marginBottom: 16,
                }}
            >
                Published Agents
            </h2>

            {profile.agents.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🤖</div>
                    <div className="empty-state-text">
                        No published agents yet
                    </div>
                </div>
            ) : (
                <div className="agent-grid">
                    {profile.agents.map((agent, i) => (
                        <AgentCard key={agent.agentId} {...agent} index={i} />
                    ))}
                </div>
            )}
        </div>
    );
}
