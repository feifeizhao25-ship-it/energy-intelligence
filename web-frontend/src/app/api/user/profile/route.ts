import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const data = await req.json();
        const { name, company, jobTitle, industry, bio } = data;

        const updatedUser = await prisma.user.update({
            where: { email: session.user.email as string },
            data: {
                name,
                company,
                jobTitle,
                industry,
                bio,
                profileCompleted: true,
            },
        });

        return NextResponse.json({ success: true, user: updatedUser });
    } catch (error: any) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email as string },
            select: {
                name: true,
                email: true,
                phone: true,
                company: true,
                jobTitle: true,
                industry: true,
                bio: true,
                profileCompleted: true,
                plan: true,
            },
        });

        return NextResponse.json({ success: true, user });
    } catch (error: any) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
