import { NextRequest, NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        name: "New Energy Agent",
        version: "1.0.0",
        protocol: "FXAP/v1",
        agentId: "futurex.energy",
        capabilities: ["data", "analytics", "scheduling"],
        endpoints: {
            manifest: "/api/internal/energy/manifest",
            execute: "/api/internal/energy/execute",
        },
    });
}

export async function POST(req: NextRequest) {
    try {
        const { message } = await req.json();

        const solarOutput = (Math.random() * 30 + 20).toFixed(1);
        const batteryLevel = Math.floor(Math.random() * 30 + 60);

        const output = `⚡ **New Energy Agent**\n\nAnalyzing your request:\n> "${message}"\n\n**Real-time Energy Dashboard:**\n| Metric | Value |\n|--------|-------|\n| Solar Output | ${solarOutput} kWh |\n| Battery Level | ${batteryLevel}% |\n| Grid Export | ${(Math.random() * 15).toFixed(1)} kWh |\n| CO₂ Saved | ${(Math.random() * 20).toFixed(1)} kg |\n\n**Tip:** Optimal charging window: 10AM - 3PM`;

        return NextResponse.json({
            output,
            data: {
                solarOutput: parseFloat(solarOutput),
                batteryLevel,
                status: "monitoring",
            },
        });
    } catch (error) {
        console.error("Energy agent error:", error);
        return NextResponse.json(
            { error: "Execution failed" },
            { status: 500 }
        );
    }
}
