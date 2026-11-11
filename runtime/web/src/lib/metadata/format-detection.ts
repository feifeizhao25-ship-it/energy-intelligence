/**
 * iOS Safari otherwise turns coordinates such as 116.4074 into telephone links,
 * rewrites the DOM, and breaks hydration on the wind page.
 * Next emits these `false` flags, in this order, as
 * `<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">`.
 */
export const cnFormatDetection = {
    telephone: false,
    date: false,
    address: false,
    email: false,
} as const;

const FORMAT_DETECTION_KEYS = ['telephone', 'date', 'address', 'email', 'url'] as const;

export function formatDetectionContent(
    detection: Partial<Record<(typeof FORMAT_DETECTION_KEYS)[number], boolean>>,
): string {
    const parts: string[] = [];
    for (const key of FORMAT_DETECTION_KEYS) {
        if (detection[key] === false) parts.push(`${key}=no`);
    }
    return parts.join(', ');
}
