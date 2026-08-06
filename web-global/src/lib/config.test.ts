import { describe, expect, it } from 'vitest';

import { extractList } from './config';

describe('extractList', () => {
  it('accepts supported API envelopes', () => {
    expect(extractList([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(extractList({ data: { items: [{ id: 2 }] } })).toEqual([{ id: 2 }]);
    expect(extractList({ results: [{ id: 3 }] })).toEqual([{ id: 3 }]);
  });

  it('rejects failed or unrecognized payloads', () => {
    expect(extractList({ code: 500, data: [] })).toBeNull();
    expect(extractList({ data: { value: 1 } })).toBeNull();
    expect(extractList(null)).toBeNull();
  });
});
