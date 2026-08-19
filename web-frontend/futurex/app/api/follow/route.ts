import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const DEMO_USER_ID = "demo-user-001";

export async function POST(req: NextRequest) {
    try {
        const { targetUserId } = await req.json();

        if (!targetUserId) {
            return NextResponse.json(
                { error: "targetUserId is required" },
                { status: 400 }
            );
        }

        if (targetUserId === DEMO_USER_ID) {
            return NextResponse.json(
                { error: "Cannot follow yourself" },
                { status: 400 }
            );
        }

        // Check if already following
        const existing = await prisma.follow.findUnique({
            where: {
                followerId_followingId: {
                    followerId: DEMO_USER_ID,
                    followingId: targetUserId,
                },
            },
        });

        if (existing) {
            // Unfollow
            await prisma.follow.delete({
                where: { id: existing.id },
            });

            return NextResponse.json({
                following: false,
                message: "Unfollowed",
            });
        }

        // Follow
        await prisma.follow.create({
            data: {
                followerId: DEMO_USER_ID,
                followingId: targetUserId,
            },
        });

        // Create notification
        await prisma.notification.create({
            data: {
                userId: targetUserId,
                type: "follow",
                actorUserId: DEMO_USER_ID,
            },
        });

        // Create activity
        await prisma.activity.create({
            data: {
                type: "follow",
                actorUserId: DEMO_USER_ID,
                metadata: JSON.stringify({ targetUserId }),
            },
        });

        return NextResponse.json({
            following: true,
            message: "Following",
        });
    } catch (error) {
        console.error("Follow error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
