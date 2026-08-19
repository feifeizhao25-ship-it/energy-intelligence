afterAll(async () => {
  await closeLoadedModuleResource('/src/jobs/queue.ts', 'closeQueues');
  await closeLoadedModuleResource('/src/data-ingestion/jobs/ingestion-job.ts', 'close');
  await closeLoadedModuleResource('/src/websocket/heartbeat.ts', 'globalHeartbeatManager', 'stop');
  await closeLoadedModuleResource('/src/websocket/connection-manager.ts', 'connectionManager', 'closeAll');
  await prisma.$disconnect();
});

async function closeLoadedModuleResource(
  moduleSuffix: string,
  exportName: string,
  methodName?: string
): Promise<void> {
  try {
    const loadedPath = Object.keys(require.cache).find(path =>
      path.endsWith(moduleSuffix)
    );
    if (!loadedPath) return;

    const loadedModule = require(loadedPath);
    const target = loadedModule?.[exportName];
    if (!target) return;

    if (methodName) {
      await target[methodName]?.();
    } else if (typeof target === 'function') {
      await target();
    }
  } catch {
    // Resource cleanup should never hide real test failures.
  }
}
