import { describe, expect, it } from 'vitest';
import { failureFromStatus, serviceNotice } from './service-notice';

describe('service notice', () => {
  it('does not call 401 or 404 a disconnected service', () => {
    expect(failureFromStatus(401)).toBe('unauthorized');
    expect(failureFromStatus(404)).toBe('missing');
    expect(serviceNotice('unauthorized', 'alerts').title).toBe('Please sign in');
    expect(serviceNotice('unauthorized', 'alerts').description).not.toMatch(/not connected/i);
    expect(serviceNotice('missing', 'alerts').description).toMatch(/404/);
    expect(serviceNotice('missing', 'alerts').description).not.toMatch(/not connected/i);
    expect(serviceNotice('offline', 'alerts').description).toMatch(/network/i);
  });
});
