jest.mock('../api/semantic-scholar', () => ({ searchPapers: jest.fn() }));
jest.mock('../api/arxiv', () => ({ searchArxiv: jest.fn() }));
jest.mock('../api/openalex', () => ({ searchOpenAlex: jest.fn() }));
jest.mock('../ai/unified', () => ({ simpleChat: jest.fn() }));

import { searchPapers } from '../api/semantic-scholar';
import { unifiedSearch } from './search';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

it('国内构建默认不调用境外学术源', async () => {
  const previousEdition = process.env.APP_EDITION;
  const previousCache = process.env.NENGJIAN_LITERATURE_CACHE;
  process.env.APP_EDITION = 'cn';
  delete process.env.OVERSEAS_LIVE;
  delete process.env.OVERSEAS_PRIVACY_ACK;
  const dir = mkdtempSync(join(tmpdir(), 'lit-'));
  const file = join(dir, 'cache.json');
  writeFileSync(file, JSON.stringify({ records: [] }));
  process.env.NENGJIAN_LITERATURE_CACHE = file;
  const empty = await unifiedSearch('光伏');
  expect(empty.notice).toBe('未配置国内学术源/未开启境外');
  expect(searchPapers).not.toHaveBeenCalled();

  writeFileSync(file, JSON.stringify({
    records: [{ source: 'arxiv-cache', externalId: '1', title: '光伏组件积灰', year: 2024, licence: 'arXiv', licenceNote: '批量缓存', abstract: '积灰' }],
  }));
  const hit = await unifiedSearch('积灰');
  expect(hit.papers.map((paper) => paper.title)).toEqual(['光伏组件积灰']);
  expect(searchPapers).not.toHaveBeenCalled();
  if (previousEdition === undefined) delete process.env.APP_EDITION; else process.env.APP_EDITION = previousEdition;
  if (previousCache === undefined) delete process.env.NENGJIAN_LITERATURE_CACHE; else process.env.NENGJIAN_LITERATURE_CACHE = previousCache;
});
