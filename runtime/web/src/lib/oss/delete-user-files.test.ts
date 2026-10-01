jest.mock('ali-oss', () => ({ __esModule: true, default: class {} }));
import { deleteUserFiles, userFilePrefix } from './client';

function fakeOss(pages: { name: string }[][]) {
  const deleted: string[] = [];
  let i = 0;
  return {
    deleted,
    client: {
      list: jest.fn(async (q: { prefix: string; marker?: string }) => {
        const objects = pages[i] ?? [];
        i += 1;
        return { objects, isTruncated: i < pages.length, nextMarker: `m${i}` };
      }),
      deleteMulti: jest.fn(async (names: string[]) => { deleted.push(...names); }),
    },
  };
}

describe('注销时删除 OSS 里的用户文件', () => {
  it('按用户前缀分页列出并全部删除', async () => {
    const p = userFilePrefix('u1');
    const { client, deleted } = fakeOss([[{ name: `${p}papers/a.pdf` }, { name: `${p}papers/b.pdf` }], [{ name: `${p}papers/c.pdf` }]]);
    expect(await deleteUserFiles('u1', client)).toBe(3);
    expect(deleted).toEqual([`${p}papers/a.pdf`, `${p}papers/b.pdf`, `${p}papers/c.pdf`]);
    expect(client.list.mock.calls[0][0]).toMatchObject({ prefix: 'users/u1/' });
  });

  it('前缀带斜杠：u1 的注销不会碰到 u10 的文件', async () => {
    const { client, deleted } = fakeOss([[{ name: 'users/u10/papers/x.pdf' }, { name: 'users/u1/papers/y.pdf' }]]);
    await deleteUserFiles('u1', client);
    expect(deleted).toEqual(['users/u1/papers/y.pdf']);
  });

  it('没配置 OSS 或没有文件：返回 0，不报错', async () => {
    expect(await deleteUserFiles('u1', null)).toBe(0);
    expect(await deleteUserFiles('u1', fakeOss([[]]).client)).toBe(0);
  });

  it('删除失败向上抛，调用方据此中止注销', async () => {
    const { client } = fakeOss([[{ name: 'users/u1/a.pdf' }]]);
    client.deleteMulti.mockRejectedValue(new Error('oss down'));
    await expect(deleteUserFiles('u1', client)).rejects.toThrow('oss down');
  });
});
