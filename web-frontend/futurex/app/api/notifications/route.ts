import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const DEMO_USER_ID = "demo-user-001";

export async function GET() {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: DEMO_USER_ID },
            orderBy: { createdAt: "desc" },
            take: 20,
            include: {
                agent: true,
            },
        });

        return NextResponse.json({ notifications });
    } catch (error) {
        console.error("Notifications error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const { notificationId } = await req.json();

        if (notificationId) {
            await prisma.notification.update({
                where: { id: notificationId },
                data: { read: true },
            });
        } else {
            // Mark all as read
            await prisma.notification.updateMany({
                where: { userId: DEMO_USER_ID, read: false },
                data: { read: true },
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Notification update error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
