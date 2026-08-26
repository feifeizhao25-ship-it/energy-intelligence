import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ agentId: string }> }
) {
    try {
        const { agentId } = await params;

        const agent = await prisma.agent.findUnique({
            where: { agentId },
            include: {
                stats: true,
                creator: {
                    include: { profile: true },
                },
            },
        });

        if (!agent) {
            return NextResponse.json(
                { error: "Agent not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ agent });
    } catch (error) {
        console.error("Get agent error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
