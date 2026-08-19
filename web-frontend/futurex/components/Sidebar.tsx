"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    MessageCircle,
    Store,
    Rss,
    Code2,
    ShoppingBag,
    Shield,
    Zap,
} from "lucide-react";

const navItems = [
    { href: "/chat", label: "Chat", icon: MessageCircle, badge: "Core" },
    { href: "/store", label: "Agent Store", icon: Store },
    { href: "/feed", label: "Feed", icon: Rss },
    { href: "/dev", label: "Developer", icon: Code2 },
    { href: "/merchant", label: "Merchant", icon: ShoppingBag },
    { href: "/admin", label: "Admin", icon: Shield },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside
            style={{
                width: "var(--sidebar-width)",
                height: "100vh",
                position: "fixed",
                left: 0,
                top: 0,
                display: "flex",
                flexDirection: "column",
                borderRight: "1px solid var(--border-color)",
                background: "var(--bg-secondary)",
                zIndex: 50,
            }}
        >
            {/* Logo */}
            <div
                style={{
                    padding: "20px 20px 16px",
                    borderBottom: "1px solid var(--border-color)",
                }}
            >
                <Link
                    href="/chat"
                    style={{
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                    }}
                >
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: "var(--radius-sm)",
                            background: "var(--gradient-primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 18,
                        }}
                    >
                        <Zap size={20} color="white" />
                    </div>
                    <div>
                        <div
                            style={{
                                fontSize: 18,
                                fontWeight: 800,
                                background:
                                    "linear-gradient(135deg, #a78bfa 0%, #06b6d4 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            FutureX
                        </div>
                        <div
                            style={{
                                fontSize: 10,
                                color: "var(--text-tertiary)",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                            }}
                        >
                            Agent OS
                        </div>
                    </div>
                </Link>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                    }}
                >
                    {navItems.map((item) => {
                        const isActive =
                            pathname === item.href ||
                            (item.href !== "/chat" && pathname.startsWith(item.href));
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                    padding: "10px 14px",
                                    borderRadius: "var(--radius-sm)",
                                    textDecoration: "none",
                                    color: isActive
                                        ? "var(--text-primary)"
                                        : "var(--text-secondary)",
                                    background: isActive
                                        ? "rgba(124, 58, 237, 0.12)"
                                        : "transparent",
                                    borderLeft: isActive
                                        ? "3px solid var(--accent-primary)"
                                        : "3px solid transparent",
                                    transition: "all 0.2s ease",
                                    fontSize: 14,
                                    fontWeight: isActive ? 600 : 400,
                                }}
                            >
                                <Icon size={18} />
                                <span style={{ flex: 1 }}>{item.label}</span>
                                {item.badge && (
                                    <span
                                        className="badge badge-primary"
                                        style={{ fontSize: 10, padding: "2px 6px" }}
                                    >
                                        {item.badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Footer */}
            <div
                style={{
                    padding: "16px 20px",
                    borderTop: "1px solid var(--border-color)",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                }}
            >
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "var(--gradient-primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "white",
                    }}
                >
                    D
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Demo User</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        🌍 Global
                    </div>
                </div>
            </div>
        </aside>
    );
}
