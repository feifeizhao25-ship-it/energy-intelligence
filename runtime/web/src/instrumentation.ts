export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startExportSweep } = await import('@/lib/exports/cache');
        startExportSweep();
    }
}
