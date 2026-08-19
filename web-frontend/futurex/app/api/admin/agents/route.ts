import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET: List agents for admin (with optional status filter)
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const status = url.searchParams.get("status");

        const where: Record<string, unknown> = {};
        if (status && status !== "all") {
            where.status = status;
        }

        const agents = await prisma.agent.findMany({
            where,
            include: {
                creator: true,
                stats: true,
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({
            agents: agents.map((a) => ({
                id: a.id,
                agentId: a.agentId,
                name: a.name,
                description: a.description,
                icon: a.icon,
                category: a.category,
                status: a.status,
                createdAt: a.createdAt.toISOString(),
                creator: { name: a.creator.name, email: a.creator.email },
            })),
        });
    } catch (error) {
        console.error("Admin agents error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH: Update agent status (approve/reject/suspend)
export async function PATCH(req: NextRequest) {
    try {
        const { agentId, status } = await req.json();

        if (!agentId || !status) {
            return NextResponse.json(
                { error: "agentId and status are required" },
                { status: 400 }
            );
        }

        const validStatuses = ["active", "pending", "rejected", "suspended"];
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
                { status: 400 }
            );
        }

        await prisma.agent.update({
            where: { agentId },
            data: { status },
        });

        return NextResponse.json({
            success: true,
            message: `Agent ${agentId} status updated to ${status}`,
        });
    } catch (error) {
        console.error("Admin update error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
