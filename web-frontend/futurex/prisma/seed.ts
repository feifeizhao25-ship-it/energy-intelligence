import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
    console.log("🌱 Seeding FutureX database...");

    // Create demo user
    const demoUser = await prisma.user.upsert({
        where: { id: "demo-user-001" },
        update: {},
        create: {
            id: "demo-user-001",
            email: "demo@futurex.ai",
            name: "Demo User",
            region: "GLOBAL",
            role: "admin",
        },
    });

    // Create demo user profile
    await prisma.userProfile.upsert({
        where: { userId: demoUser.id },
        update: {},
        create: {
            userId: demoUser.id,
            username: "demo",
            avatar: "",
            bio: "FutureX Platform Demo User",
            isPublic: true,
        },
    });

    // Create dev user
    const devUser = await prisma.user.upsert({
        where: { id: "dev-user-001" },
        update: {},
        create: {
            id: "dev-user-001",
            email: "developer@futurex.ai",
            name: "FutureX Dev",
            region: "GLOBAL",
            role: "developer",
        },
    });

    await prisma.userProfile.upsert({
        where: { userId: devUser.id },
        update: {},
        create: {
            userId: devUser.id,
            username: "futurex-official",
            avatar: "",
            bio: "Official FutureX Agent Developer",
            isPublic: true,
        },
    });

    // Built-in agents
    const agents = [
        {
            agentId: "futurex.distribution",
            name: "Distribution Agent",
            description:
                "Intelligent content distribution across multiple social platforms. Automatically optimizes posting time, audience targeting, and engagement tracking.",
            icon: "📢",
            category: "distribution",
            apiBase: "/api/internal/distribution",
            status: "active",
            creatorUserId: devUser.id,
        },
        {
            agentId: "futurex.energy",
            name: "New Energy Agent",
            description:
                "Smart energy management for solar panels, batteries, and grid optimization. Real-time monitoring, cost optimization, and carbon footprint tracking.",
            icon: "⚡",
            category: "energy",
            apiBase: "/api/internal/energy",
            status: "active",
            creatorUserId: devUser.id,
        },
        {
            agentId: "futurex.shunshi",
            name: "Shunshi Wellness Agent",
            description:
                "Traditional Chinese wellness agent based on 节气 (solar terms). Personalized health plans including diet, exercise, and lifestyle recommendations.",
            icon: "🧘",
            category: "health",
            apiBase: "/api/internal/shunshi",
            status: "active",
            creatorUserId: devUser.id,
        },
    ];

    for (const agentData of agents) {
        const agent = await prisma.agent.upsert({
            where: { agentId: agentData.agentId },
            update: { status: "active" },
            create: agentData,
        });

        await prisma.agentPublicStats.upsert({
            where: { agentId: agent.id },
            update: {},
            create: {
                agentId: agent.id,
                installCount: Math.floor(Math.random() * 500) + 100,
                runCount: Math.floor(Math.random() * 2000) + 500,
                ratingAvg: 4.2 + Math.random() * 0.7,
                ratingCount: Math.floor(Math.random() * 200) + 50,
                trendingScore: Math.random() * 5 + 3,
            },
        });

        // Auto-install for demo user
        await prisma.userAgent.upsert({
            where: {
                userId_agentId: {
                    userId: demoUser.id,
                    agentId: agent.id,
                },
            },
            update: {},
            create: {
                userId: demoUser.id,
                agentId: agent.id,
                installed: true,
                enabled: true,
            },
        });
    }

    // Create some sample third-party agents
    const thirdPartyAgents = [
        {
            agentId: "community.translator",
            name: "Universal Translator",
            description: "AI-powered translation supporting 100+ languages with context awareness and industry-specific terminology.",
            icon: "🌐",
            category: "productivity",
            status: "active",
            creatorUserId: devUser.id,
        },
        {
            agentId: "community.imageGen",
            name: "Image Creator Pro",
            description: "Generate stunning images from text descriptions. Supports multiple styles, resolutions, and batch generation.",
            icon: "🎨",
            category: "creative",
            status: "active",
            creatorUserId: devUser.id,
        },
        {
            agentId: "community.dataAnalyzer",
            name: "Data Insights",
            description: "Upload your data and get instant visualizations, trends analysis, and actionable insights powered by AI.",
            icon: "📊",
            category: "analytics",
            status: "active",
            creatorUserId: devUser.id,
        },
        {
            agentId: "community.codeReview",
            name: "Code Reviewer",
            description: "Automated code review with security scanning, performance optimization suggestions, and best practice enforcement.",
            icon: "🔍",
            category: "developer",
            status: "active",
            creatorUserId: devUser.id,
        },
        {
            agentId: "community.mealPlanner",
            name: "Smart Meal Planner",
            description: "Personalized meal planning based on dietary preferences, nutritional goals, and available ingredients.",
            icon: "🍽️",
            category: "health",
            status: "active",
            creatorUserId: devUser.id,
        },
        {
            agentId: "community.travelBot",
            name: "Travel Concierge",
            description: "Plan your perfect trip with AI-optimized itineraries, local recommendations, and real-time travel updates.",
            icon: "✈️",
            category: "lifestyle",
            status: "pending",
            creatorUserId: devUser.id,
        },
    ];

    for (const agentData of thirdPartyAgents) {
        const agent = await prisma.agent.upsert({
            where: { agentId: agentData.agentId },
            update: {},
            create: agentData,
        });

        await prisma.agentPublicStats.upsert({
            where: { agentId: agent.id },
            update: {},
            create: {
                agentId: agent.id,
                installCount: Math.floor(Math.random() * 300) + 10,
                runCount: Math.floor(Math.random() * 1000) + 50,
                ratingAvg: 3.5 + Math.random() * 1.3,
                ratingCount: Math.floor(Math.random() * 100) + 5,
                trendingScore: Math.random() * 4 + 1,
            },
        });
    }

    console.log("✅ Seed complete!");
    console.log(`   Users: 2`);
    console.log(`   Agents: ${agents.length + thirdPartyAgents.length}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
