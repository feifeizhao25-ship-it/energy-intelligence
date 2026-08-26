import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

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

        // Find the agent
        const agent = await prisma.agent.findUnique({
            where: { agentId },
        });

        if (!agent) {
            return NextResponse.json(
                { error: "Agent not found" },
                { status: 404 }
            );
        }

        // Check if already installed
        const existing = await prisma.userAgent.findUnique({
            where: {
                userId_agentId: {
                    userId: DEMO_USER_ID,
                    agentId: agent.id,
                },
            },
        });

        if (existing) {
            // Toggle install/uninstall
            await prisma.userAgent.update({
                where: { id: existing.id },
                data: { installed: !existing.installed },
            });

            // Update install count
            if (existing.installed) {
                await prisma.agentPublicStats.updateMany({
                    where: { agentId: agent.id },
                    data: { installCount: { decrement: 1 } },
                });
            } else {
                await prisma.agentPublicStats.updateMany({
                    where: { agentId: agent.id },
                    data: { installCount: { increment: 1 } },
                });
            }

            return NextResponse.json({
                installed: !existing.installed,
                message: existing.installed ? "Agent uninstalled" : "Agent installed",
            });
        }

        // New install
        await prisma.userAgent.create({
            data: {
                userId: DEMO_USER_ID,
                agentId: agent.id,
                installed: true,
                enabled: true,
            },
        });

        // Update install count
        await prisma.agentPublicStats.updateMany({
            where: { agentId: agent.id },
            data: { installCount: { increment: 1 } },
        });

        // Create activity
        await prisma.activity.create({
            data: {
                type: "install",
                actorUserId: DEMO_USER_ID,
                agentId: agent.id,
            },
        });

        return NextResponse.json({
            installed: true,
            message: "Agent installed successfully",
        });
    } catch (error) {
        console.error("Install error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
