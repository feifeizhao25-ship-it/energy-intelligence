import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const DEMO_USER_ID = "demo-user-001";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await params;

        const profile = await prisma.userProfile.findUnique({
            where: { username },
            include: {
                user: true,
            },
        });

        if (!profile) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 }
            );
        }

        // Get user's agents
        const agents = await prisma.agent.findMany({
            where: {
                creatorUserId: profile.userId,
                status: "active",
                visibility: "public",
            },
            include: { stats: true },
        });

        // Get follow counts
        const followerCount = await prisma.follow.count({
            where: { followingId: profile.userId },
        });

        const followingCount = await prisma.follow.count({
            where: { followerId: profile.userId },
        });

        // Check if current user follows this user
        const isFollowing = !!(await prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: DEMO_USER_ID,
                    followingId: profile.userId,
                },
            },
        }));

        return NextResponse.json({
            user: {
                id: profile.user.id,
                name: profile.user.name,
                email: profile.user.email,
                region: profile.user.region,
            },
            profile: {
                username: profile.username,
                avatar: profile.avatar,
                bio: profile.bio,
            },
            agents: agents.map((a) => ({
                agentId: a.agentId,
                name: a.name,
                description: a.description,
                icon: a.icon,
                category: a.category,
                installCount: a.stats?.installCount || 0,
                runCount: a.stats?.runCount || 0,
                ratingAvg: a.stats?.ratingAvg || 0,
                trendingScore: a.stats?.trendingScore || 0,
            })),
            followerCount,
            followingCount,
            isFollowing,
        });
    } catch (error) {
        console.error("Profile error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
