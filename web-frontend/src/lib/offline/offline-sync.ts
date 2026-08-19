/**
 * 离线同步中心
 * 负责在离线时收集 API 请求，并在恢复在线时通过 Background Sync 同步
 */

const OFFLINE_QUEUE_KEY = 'offline-pending-tasks';

interface OfflineTask {
    id: string;
    url: string;
    method: string;
    body: any;
    timestamp: number;
    description: string;
}

/**
 * 将请求加入离线队列
 */
export async function queueOfflineTask(description: string, url: string, method: string, body: any) {
    if (typeof window === 'undefined') return;

    const task: OfflineTask = {
        id: `task-${Date.now()}`,
        url,
        method,
        body,
        timestamp: Date.now(),
        description
    };

    const queueStr = localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]';
    const queue = JSON.parse(queueStr);
    queue.push(task);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

    // 尝试注册 Background Sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        try {
            // @ts-ignore
            await registration.sync.register('sync-calculations');
            console.log('Background Sync registered for calculations');
        } catch (err) {
            console.error('Background Sync registration failed:', err);
        }
    }

    return task;
}

/**
 * 获取挂起的任务
 */
export function getPendingTasks(): OfflineTask[] {
    if (typeof window === 'undefined') return [];
    const queueStr = localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]';
    return JSON.parse(queueStr);
}

/**
 * 清空队列 (同步完成后调用)
 */
export function clearPendingTasks() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
}
