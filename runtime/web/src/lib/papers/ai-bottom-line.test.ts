jest.mock('../ai/unified', () => ({ simpleChat: jest.fn() }));
import { simpleChat } from '../ai/unified';
import { generateSummary } from './ai';

it('摘要经过底线过滤并附带引用', async () => {
  jest.mocked(simpleChat).mockResolvedValueOnce('本文建议投资该技术。');
  const blocked = await generateSummary('摘要', '光伏积灰综述');
  expect(blocked).not.toMatch(/建议投资/);
  expect(blocked).toMatch(/引用：光伏积灰综述/);

  jest.mocked(simpleChat).mockResolvedValueOnce('### 主要方法\n对比了清洗周期。');
  const kept = await generateSummary('摘要', '光伏积灰综述');
  expect(kept).toMatch(/清洗周期/);
  expect(kept).toMatch(/引用：光伏积灰综述/);
});
