import type { Region } from "./dbRouter";

// Detect user region based on various signals
export function detectRegion(headers?: Headers): Region {
    if (!headers) return "GLOBAL";

    // Check explicit header
    const regionHeader = headers.get("x-futurex-region");
    if (regionHeader === "CN") return "CN";

    // Check Accept-Language for Chinese
    const acceptLang = headers.get("accept-language") || "";
    if (acceptLang.startsWith("zh")) return "CN";

    // Check timezone via CF header or custom header
    const timezone = headers.get("x-timezone") || "";
    if (timezone.includes("Asia/Shanghai") || timezone.includes("Asia/Chongqing")) {
        return "CN";
    }

    return "GLOBAL";
}

export const regionConfig = {
    CN: {
        name: "中国",
        flag: "🇨🇳",
        apiBase: "/api",
        timezone: "Asia/Shanghai",
    },
    GLOBAL: {
        name: "Global",
        flag: "🌍",
        apiBase: "/api",
        timezone: "UTC",
    },
} as const;
