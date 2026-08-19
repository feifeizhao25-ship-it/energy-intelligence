// FutureX Task Scheduler
// Run with: npx tsx scripts/cron.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
});

async function runScheduledTasks() {
    console.log(`[${new Date().toISOString()}] Checking for scheduled tasks...`);

    try {
        const tasks = await prisma.task.findMany({
            where: {
                status: "pending",
                schedule: { not: null },
            },
            include: {
                agent: true,
            },
        });

        console.log(`  Found ${tasks.length} pending tasks`);

        for (const task of tasks) {
            console.log(`  Executing task ${task.id} (Agent: ${task.agent.agentId})`);

            try {
                await prisma.task.update({
                    where: { id: task.id },
                    data: { status: "running" },
                });

                await prisma.run.create({
                    data: {
                        userId: task.userId,
                        agentId: task.agentId,
                        status: "completed",
                        input: `Scheduled task: ${task.id}`,
                        output: "Task executed via scheduler",
                    },
                });

                await prisma.task.update({
                    where: { id: task.id },
                    data: {
                        status: "completed",
                        resultJson: JSON.stringify({ completedAt: new Date() }),
                    },
                });

                console.log(`  ✅ Task ${task.id} completed`);
            } catch (err) {
                console.error(`  ❌ Task ${task.id} failed:`, err);
                await prisma.task.update({
                    where: { id: task.id },
                    data: { status: "failed" },
                });
            }
        }
    } catch (error) {
        console.error("Scheduler error:", error);
    }
}

async function updateTrendingScores() {
    console.log(`[${new Date().toISOString()}] Updating trending scores...`);

    try {
        const stats = await prisma.agentPublicStats.findMany({
            include: { agent: true },
        });

        for (const stat of stats) {
            const daysSinceCreated = Math.max(
                1,
                Math.floor(
                    (Date.now() - stat.agent.createdAt.getTime()) / (1000 * 60 * 60 * 24)
                )
            );

            const recency = Math.max(1, 30 - daysSinceCreated) / 30;
            const popularity = Math.log10(stat.installCount + 1) * 0.3;
            const usage = Math.log10(stat.runCount + 1) * 0.2;

            const trendingScore = Number(
                (recency * 0.2 + popularity + usage).toFixed(2)
            );

            await prisma.agentPublicStats.update({
                where: { id: stat.id },
                data: { trendingScore, updatedAt: new Date() },
            });
        }

        console.log(`  Updated ${stats.length} trending scores`);
    } catch (error) {
        console.error("Trending update error:", error);
    }
}

async function main() {
    console.log("🚀 FutureX Scheduler started");
    console.log("   Running task check every 60 seconds");
    console.log("   Running trending update every 5 minutes\n");

    let iteration = 0;

    const interval = setInterval(async () => {
        iteration++;
        await runScheduledTasks();
        if (iteration % 5 === 0) {
            await updateTrendingScores();
        }
    }, 60000);

    await runScheduledTasks();
    await updateTrendingScores();

    process.on("SIGINT", async () => {
        console.log("\n🛑 Scheduler shutting down...");
        clearInterval(interval);
        await prisma.$disconnect();
        process.exit(0);
    });
}

main();
