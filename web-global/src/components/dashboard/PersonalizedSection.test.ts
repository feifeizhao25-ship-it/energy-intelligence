import { describe, expect, it } from 'vitest';

import { resolvePersonaDay } from './personalization-preview';

describe('international personalization preview isolation', () => {
  it('accepts the two international personas and valid days', () => {
    expect(resolvePersonaDay(new URLSearchParams('persona=sarah_miller&day=7')))
      .toEqual({ persona: 'sarah_miller', day: 7 });
  });

  it('rejects a domestic persona instead of mixing Chinese content', () => {
    expect(resolvePersonaDay(new URLSearchParams('persona=chen_xin&day=4')))
      .toEqual({ persona: 'john_smith', day: 4 });
  });

  it('bounds invalid days and unknown personas to safe defaults', () => {
    expect(resolvePersonaDay(new URLSearchParams('persona=unknown&day=99')))
      .toEqual({ persona: 'john_smith', day: 1 });
  });
});
