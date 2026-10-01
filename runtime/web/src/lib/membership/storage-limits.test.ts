jest.mock('@/lib/prisma', () => ({ prisma: {} }));
import { enforceStorageLimit, type StorageDeps } from './storage-limits';

const deps = (plan: string, used: number, expire: Date | null = new Date('2099-01-01')): StorageDeps => ({
  loadPlan: async () => ({ plan, planExpireAt: expire }),
  count: async () => used,
});

describe('保存类额度', () => {
  it('免费版 1 个项目：已有 1 个再建被拒，中文提示带上限', async () => {
    const res = await enforceStorageLimit('u', 'projects', deps('FREE', 1, null));
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toBe('STORAGE_LIMIT_EXCEEDED');
    expect(body.message).toBe('项目数量已达当前会员档上限（1），请升级会员或删除不用的项目');
  });

  it('没满放行；专业版 50 个项目内放行，满 50 拒绝', async () => {
    expect(await enforceStorageLimit('u', 'projects', deps('FREE', 0, null))).toBeNull();
    expect(await enforceStorageLimit('u', 'projects', deps('PRO', 49))).toBeNull();
    expect((await enforceStorageLimit('u', 'projects', deps('PRO', 50)))!.status).toBe(403);
  });

  it('过期的专业版按免费版限额', async () => {
    const res = await enforceStorageLimit('u', 'saved_papers', deps('PRO', 5, new Date('2020-01-01')));
    expect(res!.status).toBe(403);
  });

  it('企业版不限', async () => {
    expect(await enforceStorageLimit('u', 'projects', deps('ENTERPRISE', 100000))).toBeNull();
  });

  it('额度为 0 的功能（免费版电站）提示不含该功能', async () => {
    const res = await enforceStorageLimit('u', 'stations', deps('FREE', 0, null));
    expect((await res!.json()).message).toBe('当前会员档不含电站功能，请升级会员');
  });
});
