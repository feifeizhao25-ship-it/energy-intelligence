import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const DEMO_USER_ID = "demo-user-001";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            agentId,
            name,
            description,
            icon,
            category,
            apiBase,
            authType,
            manifestJson,
            visibility,
            regionScope,
        } = body;

        if (!agentId || !name) {
            return NextResponse.json(
                { error: "agentId and name are required" },
                { status: 400 }
            );
        }

        // Check if agent ID already exists
        const existing = await prisma.agent.findUnique({
            where: { agentId },
        });

        if (existing) {
            return NextResponse.json(
                { error: "Agent ID already exists" },
                { status: 409 }
            );
        }

        // Create agent
        const agent = await prisma.agent.create({
            data: {
                agentId,
                name,
                description: description || "",
                icon: icon || "🤖",
                category: category || "general",
                apiBase: apiBase || "",
                authType: authType || "none",
                manifestJson: manifestJson || "{}",
                visibility: visibility || "public",
                status: "pending",
                regionScope: regionScope || "GLOBAL",
                creatorUserId: DEMO_USER_ID,
            },
        });

        // Create stats
        await prisma.agentPublicStats.create({
            data: {
                agentId: agent.id,
                installCount: 0,
                runCount: 0,
                ratingAvg: 0,
                ratingCount: 0,
                trendingScore: 0,
            },
        });

        // Create activity
        await prisma.activity.create({
            data: {
                type: "create_agent",
                actorUserId: DEMO_USER_ID,
                agentId: agent.id,
            },
        });

        return NextResponse.json({
            agent: {
                id: agent.id,
                agentId: agent.agentId,
                name: agent.name,
                status: agent.status,
            },
            message: "Agent created and submitted for review",
        });
    } catch (error) {
        console.error("Create agent error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
