import prisma from "./db";

export interface AgentExecutionInput {
    agentId: string;
    userId: string;
    message: string;
    context?: Record<string, unknown>;
}

export interface AgentExecutionResult {
    success: boolean;
    output: string;
    data?: Record<string, unknown>;
    error?: string;
}

// Built-in agent handlers
const builtinHandlers: Record<
    string,
    (input: AgentExecutionInput) => Promise<AgentExecutionResult>
> = {
    "futurex.distribution": async (input) => {
        return {
            success: true,
            output: `📢 **Distribution Agent**\n\nI've analyzed your content distribution request:\n\n> "${input.message}"\n\n**Recommended Actions:**\n1. 🎯 Identify target audience segments\n2. 📱 Distribute across 5 social platforms\n3. 📊 Track engagement metrics\n4. 🔄 Optimize based on performance\n\n**Estimated Reach:** 15,000 - 50,000 impressions\n**Best Time to Post:** Today at 7:00 PM\n\n_Distribution plan is ready. Enable auto-scheduling to publish automatically._`,
            data: {
                platforms: ["WeChat", "Weibo", "Douyin", "Xiaohongshu", "Twitter"],
                estimatedReach: 32000,
                scheduledTime: "19:00",
            },
        };
    },

    "futurex.energy": async (input) => {
        return {
            success: true,
            output: `⚡ **New Energy Agent**\n\nAnalyzing your energy request:\n\n> "${input.message}"\n\n**Energy Report:**\n| Metric | Value |\n|--------|-------|\n| Solar Output Today | 42.5 kWh |\n| Battery Level | 87% |\n| Grid Export | 12.3 kWh |\n| CO₂ Saved | 18.7 kg |\n\n**Recommendations:**\n1. 🔋 Shift heavy loads to 10AM-3PM for peak solar\n2. 💰 Sell excess to grid during peak hours (¥0.85/kWh)\n3. 🌡️ Pre-cool home at 2PM using solar surplus\n\n_Enable auto-scheduling to optimize energy usage automatically._`,
            data: {
                solarOutput: 42.5,
                batteryLevel: 87,
                gridExport: 12.3,
                co2Saved: 18.7,
            },
        };
    },

    "futurex.shunshi": async (input) => {
        return {
            success: true,
            output: `🧘 **Shunshi Wellness Agent**\n\nPersonalized wellness analysis:\n\n> "${input.message}"\n\n**Today's Wellness Plan (based on 节气: 惊蛰):**\n\n🌅 **Morning (6:00-8:00)**\n- Gentle stretching & Tai Chi (20 min)\n- Warm congee w/ goji berries & dates\n\n☀️ **Midday (11:00-13:00)**\n- Light walk outdoors (15 min)\n- Green tea with chrysanthemum\n\n🌙 **Evening (18:00-21:00)**\n- Meditation & breathing exercises (10 min)\n- Warm foot soak with ginger\n- Sleep by 10:30 PM\n\n**Key Focus:** Spring liver nourishment 🌿\n\n_Enable daily reminders for your personalized schedule._`,
            data: {
                season: "Spring",
                solarTerm: "惊蛰",
                focusOrgan: "Liver",
                sleepTarget: "22:30",
            },
        };
    },
};

export async function executeAgent(
    input: AgentExecutionInput
): Promise<AgentExecutionResult> {
    try {
        // Check if it's a built-in agent
        if (builtinHandlers[input.agentId]) {
            const result = await builtinHandlers[input.agentId](input);

            // Save run record
            await prisma.run.create({
                data: {
                    userId: input.userId,
                    agentId: (
                        await prisma.agent.findUnique({
                            where: { agentId: input.agentId },
                        })
                    )!.id,
                    status: result.success ? "completed" : "failed",
                    input: input.message,
                    output: result.output,
                },
            });

            // Update run count
            await prisma.agentPublicStats.updateMany({
                where: {
                    agent: { agentId: input.agentId },
                },
                data: {
                    runCount: { increment: 1 },
                },
            });

            return result;
        }

        // External agent - call via FXAP protocol
        const agent = await prisma.agent.findUnique({
            where: { agentId: input.agentId },
        });

        if (!agent || !agent.apiBase) {
            return {
                success: false,
                output: "",
                error: `Agent ${input.agentId} not found or has no API endpoint`,
            };
        }

        try {
            const response = await fetch(`${agent.apiBase}/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: input.message,
                    userId: input.userId,
                    context: input.context,
                }),
            });

            if (!response.ok) {
                throw new Error(`Agent API returned ${response.status}`);
            }

            const data = await response.json();

            await prisma.run.create({
                data: {
                    userId: input.userId,
                    agentId: agent.id,
                    status: "completed",
                    input: input.message,
                    output: data.output || JSON.stringify(data),
                },
            });

            return {
                success: true,
                output: data.output || JSON.stringify(data),
                data,
            };
        } catch (fetchError) {
            return {
                success: false,
                output: "",
                error: `Failed to execute agent: ${fetchError}`,
            };
        }
    } catch (error) {
        return {
            success: false,
            output: "",
            error: `Runtime error: ${error}`,
        };
    }
}
