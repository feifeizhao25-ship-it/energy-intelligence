"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2 } from "lucide-react";
import ChatMessage from "@/components/ChatMessage";
import AgentSuggestion from "@/components/AgentSuggestion";

interface Message {
    id: string;
    role: "user" | "assistant" | "agent";
    content: string;
    agentName?: string;
    agentIcon?: string;
}

interface SuggestedAgent {
    agentId: string;
    name: string;
    icon: string;
    description: string;
    category: string;
}

const quickActions = [
    {
        label: "📢 Distribute my content",
        message: "Help me distribute my new product launch content across social platforms",
    },
    {
        label: "⚡ Energy report",
        message: "Show me today's solar energy output and optimization suggestions",
    },
    {
        label: "🧘 Wellness plan",
        message: "Create a personalized wellness plan for today based on the current season",
    },
    {
        label: "🔍 Find agents",
        message: "Show me the most popular agents available",
    },
];

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [suggestedAgents, setSuggestedAgents] = useState<SuggestedAgent[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async (content: string) => {
        if (!content.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: content.trim(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setSuggestedAgents([]);
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: content.trim() }),
            });

            const data = await res.json();

            if (data.suggestedAgents?.length > 0) {
                setSuggestedAgents(data.suggestedAgents);
            }

            if (data.assistantMessage) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        content: data.assistantMessage,
                    },
                ]);
            }

            if (data.agentResponse) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: (Date.now() + 2).toString(),
                        role: "agent",
                        content: data.agentResponse.output,
                        agentName: data.agentResponse.agentName,
                        agentIcon: data.agentResponse.agentIcon,
                    },
                ]);
            }
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content:
                        "Sorry, something went wrong. Please try again." +
                        (error instanceof Error ? ` (${error.message})` : ""),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    return (
        <div
            style={{
                height: "100vh",
                display: "flex",
                flexDirection: "column",
                background: "var(--bg-primary)",
            }}
        >
            {/* Messages Area */}
            <div
                style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "24px 24px 0",
                }}
            >
                {messages.length === 0 ? (
                    <div
                        style={{
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "32px",
                            paddingBottom: "80px",
                        }}
                    >
                        {/* Hero */}
                        <div style={{ textAlign: "center" }} className="animate-fade-in">
                            <div
                                style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: "var(--radius-lg)",
                                    background: "var(--gradient-primary)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    margin: "0 auto 20px",
                                    boxShadow: "0 0 40px rgba(124, 58, 237, 0.3)",
                                }}
                            >
                                <Sparkles size={32} color="white" />
                            </div>
                            <h1
                                style={{
                                    fontSize: 32,
                                    fontWeight: 800,
                                    background: "var(--gradient-primary)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    marginBottom: "8px",
                                }}
                            >
                                Welcome to FutureX
                            </h1>
                            <p
                                style={{
                                    color: "var(--text-secondary)",
                                    fontSize: 15,
                                    maxWidth: 480,
                                }}
                            >
                                Your AI Agent Operating System. Just type what you need — I&#39;ll
                                find the right agent and execute it for you.
                            </p>
                        </div>

                        {/* Quick Actions */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: "12px",
                                maxWidth: 560,
                                width: "100%",
                            }}
                        >
                            {quickActions.map((action, i) => (
                                <button
                                    key={i}
                                    className="animate-slide-up"
                                    style={{
                                        background: "var(--bg-card)",
                                        border: "1px solid var(--border-color)",
                                        borderRadius: "var(--radius-md)",
                                        padding: "14px 16px",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        color: "var(--text-primary)",
                                        fontSize: 13,
                                        fontWeight: 500,
                                        transition: "all 0.3s ease",
                                        animationDelay: `${i * 0.1}s`,
                                        animationFillMode: "backwards",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = "var(--border-hover)";
                                        e.currentTarget.style.transform = "translateY(-2px)";
                                        e.currentTarget.style.boxShadow = "var(--shadow-glow)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = "var(--border-color)";
                                        e.currentTarget.style.transform = "translateY(0)";
                                        e.currentTarget.style.boxShadow = "none";
                                    }}
                                    onClick={() => sendMessage(action.message)}
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{ maxWidth: 800, margin: "0 auto" }}>
                        {messages.map((msg, i) => (
                            <ChatMessage
                                key={msg.id}
                                role={msg.role}
                                content={msg.content}
                                agentName={msg.agentName}
                                agentIcon={msg.agentIcon}
                                index={i}
                            />
                        ))}

                        {/* Agent Suggestions */}
                        {suggestedAgents.length > 0 && (
                            <div style={{ padding: "12px 0" }}>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--text-tertiary)",
                                        marginBottom: "8px",
                                        fontWeight: 500,
                                    }}
                                >
                                    Recommended Agents:
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        gap: "10px",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    {suggestedAgents.map((agent, i) => (
                                        <AgentSuggestion
                                            key={agent.agentId}
                                            name={agent.name}
                                            icon={agent.icon}
                                            description={agent.description}
                                            category={agent.category}
                                            index={i}
                                            onSelect={() =>
                                                sendMessage(
                                                    `Use ${agent.name} for: ${messages[messages.length - 1]?.content || "my task"}`
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Loading */}
                        {isLoading && (
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    padding: "12px 0",
                                    color: "var(--text-secondary)",
                                    fontSize: 13,
                                }}
                                className="animate-fade-in"
                            >
                                <Loader2
                                    size={16}
                                    style={{
                                        animation: "spin 1s linear infinite",
                                    }}
                                />
                                Thinking...
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div
                style={{
                    padding: "16px 24px 24px",
                    background:
                        "linear-gradient(to top, var(--bg-primary) 80%, transparent)",
                }}
            >
                <div
                    style={{
                        maxWidth: 800,
                        margin: "0 auto",
                        position: "relative",
                    }}
                >
                    <div
                        className="glass"
                        style={{
                            borderRadius: "var(--radius-lg)",
                            padding: "4px",
                            display: "flex",
                            alignItems: "flex-end",
                            gap: "8px",
                        }}
                    >
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Tell me what you need..."
                            rows={1}
                            style={{
                                flex: 1,
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                color: "var(--text-primary)",
                                fontSize: 14,
                                padding: "12px 16px",
                                resize: "none",
                                fontFamily: "inherit",
                                lineHeight: 1.5,
                                maxHeight: "120px",
                            }}
                        />
                        <button
                            className="btn-primary"
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim() || isLoading}
                            style={{
                                borderRadius: "var(--radius-sm)",
                                padding: "10px 14px",
                                opacity: !input.trim() || isLoading ? 0.5 : 1,
                                margin: "4px",
                            }}
                        >
                            {isLoading ? <Loader2 size={18} /> : <Send size={18} />}
                        </button>
                    </div>

                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            marginTop: "8px",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 11,
                                color: "var(--text-tertiary)",
                            }}
                        >
                            FutureX automatically finds and executes the best agent for your
                            request
                        </span>
                    </div>
                </div>
            </div>

            <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
        </div>
    );
}
