import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';

const isTestRuntime = process.env.NODE_ENV === 'test';

// Redis连接
export const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  lazyConnect: isTestRuntime,
  enableOfflineQueue: !isTestRuntime,
});
// 优雅关闭
export async function closeQueues() {
  await Promise.allSettled(Object.values(queues).map(queue => queue.close()));

  if (redisConnection.status !== 'end') {
    if (isTestRuntime) {
      redisConnection.disconnect();
      return;
    }

    await Promise.race([
      redisConnection.quit(),
      new Promise(resolve => setTimeout(resolve, 2000)),
    ]);
    redisConnection.disconnect();
  }
}