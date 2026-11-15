const PHONE = /1[3-9]\d{9}/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const IDCARD = /\d{17}[\dXx]/g;

export function stripPii(text: string) {
    return (text || '').replace(PHONE, '[redacted]').replace(EMAIL, '[redacted]').replace(IDCARD, '[redacted]').slice(0, 500);
}

export async function recordFeedback(kind: 'thumbs_down' | 'low_rating' | 'failed_citation' | 'blocked_output', text: string) {
    const base = (process.env.BACKEND_INTERNAL_URL || '').replace(/\/$/, '');
    const token = process.env.NENGJIAN_INTERNAL_TOKEN || '';
    if (!base || !token) return { stored: false as const };
    try {
        const response = await fetch(`${base}/api/v1/internal/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Token': token },
            body: JSON.stringify({ kind, text: stripPii(text) }),
        });
        return { stored: response.ok as boolean };
    } catch {
        return { stored: false as const };
    }
}
