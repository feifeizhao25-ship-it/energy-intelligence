"use client";

interface ChatMessageProps {
    role: "user" | "assistant" | "agent";
    content: string;
    agentName?: string;
    agentIcon?: string;
    timestamp?: string;
    index?: number;
}

export default function ChatMessage({
    role,
    content,
    agentName,
    agentIcon,
    index = 0,
}: ChatMessageProps) {
    const isUser = role === "user";

    return (
        <div
            className="animate-fade-in"
            style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
                padding: "4px 0",
                animationDelay: `${index * 0.08}s`,
                animationFillMode: "backwards",
            }}
        >
            <div
                style={{
                    maxWidth: "80%",
                    display: "flex",
                    gap: "10px",
                    flexDirection: isUser ? "row-reverse" : "row",
                    alignItems: "flex-start",
                }}
            >
                {/* Avatar */}
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: isUser
                            ? "var(--gradient-primary)"
                            : role === "agent"
                                ? "rgba(5, 150, 105, 0.2)"
                                : "var(--bg-tertiary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: isUser ? 14 : 16,
                        fontWeight: 700,
                        color: "white",
                        flexShrink: 0,
                        border:
                            role === "agent"
                                ? "1px solid rgba(52, 211, 153, 0.3)"
                                : "1px solid var(--border-color)",
                    }}
                >
                    {isUser ? "U" : agentIcon || "✨"}
                </div>

                {/* Message */}
                <div>
                    {!isUser && (
                        <div
                            style={{
                                fontSize: 12,
                                color: role === "agent" ? "#34d399" : "var(--text-accent)",
                                fontWeight: 600,
                                marginBottom: "4px",
                            }}
                        >
                            {role === "agent" ? agentName || "Agent" : "FutureX"}
                        </div>
                    )}
                    <div
                        style={{
                            background: isUser
                                ? "var(--accent-primary)"
                                : "var(--bg-card)",
                            border: isUser ? "none" : "1px solid var(--border-color)",
                            borderRadius: isUser
                                ? "var(--radius-lg) var(--radius-lg) 4px var(--radius-lg)"
                                : "var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px",
                            padding: "12px 16px",
                            fontSize: 14,
                            lineHeight: 1.7,
                            color: isUser ? "white" : "var(--text-primary)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                        }}
                        dangerouslySetInnerHTML={{
                            __html: isUser
                                ? content
                                : content
                                    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                    .replace(/\n/g, "<br/>")
                                    // Table rendering logic
                                    .replace(/\|(.+?)\|/g, (match) => {
                                        if (match.includes('---')) return '<hr style="border-color: var(--border-color); margin: 8px 0" />';
                                        const cells = match.split('|').filter(c => c.trim().length > 0);
                                        return `<div style="display: grid; grid-template-columns: repeat(${cells.length}, 1fr); gap: 8px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05)">
                                            ${cells.map(c => `<div style="padding: 4px">${c.trim()}</div>`).join('')}
                                        </div>`;
                                    }),
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
