import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

const DEMO_USER_ID = "demo-user-001";

export async function POST(req: NextRequest) {
    try {
        const { agentId } = await req.json();

        if (!agentId) {
            return NextResponse.json(
                { error: "agentId is required" },
                { status: 400 }
            );
        }

        const agent = await prisma.agent.findUnique({
            where: { agentId },
        });

        if (!agent) {
            return NextResponse.json(
                { error: "Agent not found" },
                { status: 404 }
            );
        }

        // Generate share code
        const shareCode = uuidv4().slice(0, 8);

        // Create share record
        await prisma.agentShare.create({
            data: {
                agentId: agent.id,
                shareCode,
                creatorUserId: DEMO_USER_ID,
            },
        });

        // Create activity
        await prisma.activity.create({
            data: {
                type: "share",
                actorUserId: DEMO_USER_ID,
                agentId: agent.id,
                metadata: JSON.stringify({ shareCode }),
            },
        });

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const shareUrl = `${baseUrl}/agent/${agentId}?ref=${shareCode}`;

        return NextResponse.json({
            shareUrl,
            shareCode,
        });
    } catch (error) {
        console.error("Share error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
