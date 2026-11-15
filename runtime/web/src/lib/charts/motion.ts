export const chartMotionMs = 200;

export function chartPalette(dark: boolean): string[] {
    return dark
        ? ['#7dcea0', '#d7e26a', '#e0b15a', '#d9897a']
        : ['#0e2a2b', '#15803d', '#c26a12', '#b42318'];
}
