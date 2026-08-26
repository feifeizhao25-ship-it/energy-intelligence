import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { analyzeIntent } from "@/lib/intentAnalyzer";
import { searchAgents } from "@/lib/agentSearch";
import { rankAgents } from "@/lib/agentRank";
import { executeAgent } from "@/lib/agentRuntime";

const DEMO_USER_ID = "demo-user-001";

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();

        if (!message || typeof message !== "string") {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        // 1. Save user message
        await prisma.message.create({
            data: {
                userId: DEMO_USER_ID,
                role: "user",
                content: message,
            },
        });

        // 2. Analyze intent
        const intent = analyzeIntent(message);

        // 3. Search agents based on intent
        const agents = await searchAgents(
            intent.suggestedAgentId || undefined,
            intent.category !== "general" ? intent.category : undefined
        );

        // 4. Rank agents
        const rankedAgents = rankAgents(agents, {
            preferredCategory: intent.category,
        });

        // 5. Decide if we should auto-execute
        const topAgent = rankedAgents[0];
        const shouldExecute =
            intent.confidence > 0.2 && topAgent && intent.suggestedAgentId;

        let agentResponse = null;
        let assistantMessage = "";

        if (shouldExecute && topAgent) {
            // Execute the top matching agent
            const result = await executeAgent({
                agentId: topAgent.agentId,
                userId: DEMO_USER_ID,
                message,
            });

            if (result.success) {
                agentResponse = {
                    output: result.output,
                    agentName: topAgent.name,
                    agentIcon: topAgent.icon,
                    agentId: topAgent.agentId,
                    data: result.data,
                };

                // Save assistant message
                await prisma.message.create({
                    data: {
                        userId: DEMO_USER_ID,
                        role: "assistant",
                        content: result.output,
                    },
                });
            } else {
                assistantMessage = `I found the **${topAgent.name}** agent for your request, but encountered an issue: ${result.error}. Would you like to try again?`;
            }
        } else if (intent.category !== "general") {
            // We have a category match but no agent auto-executed
            assistantMessage = `I understand you're looking for **${intent.category}** assistance. ${rankedAgents.length > 0
                    ? `I found ${rankedAgents.length} agent(s) that can help. Check the suggestions below!`
                    : "I don't have a matching agent yet. Would you like to search the Agent Store?"
                }`;
        } else {
            // General conversation
            assistantMessage =
                "I'm your FutureX assistant! I can help you find and execute AI agents. Try asking me to:\n\n" +
                "📢 **Distribute content** across social platforms\n" +
                "⚡ **Check energy** output and optimization\n" +
                "🧘 **Get wellness** recommendations\n" +
                "🔍 **Search** for specific agents\n\n" +
                "What would you like to do?";
        }

        // 6. Prepare suggested agents (top 3 that weren't auto-executed)
        const suggestedAgents = rankedAgents
            .filter((a) => a.agentId !== topAgent?.agentId || !shouldExecute)
            .slice(0, 3)
            .map((a) => ({
                agentId: a.agentId,
                name: a.name,
                icon: a.icon,
                description: a.description,
                category: a.category,
            }));

        return NextResponse.json({
            assistantMessage,
            agentResponse,
            suggestedAgents,
            intent: {
                category: intent.category,
                confidence: intent.confidence,
            },
        });
    } catch (error) {
        console.error("Chat API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
