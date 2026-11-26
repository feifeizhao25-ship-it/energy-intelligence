import assert from 'node:assert/strict';
import test from 'node:test';

import { failureFromStatus, serviceNotice } from './fetch-status.ts';

test('401 is sign-in, 404 is a missing address, and only a network failure is offline', () => {
  assert.equal(failureFromStatus(401), 'unauthorized');
  assert.equal(failureFromStatus(404), 'missing');
  assert.equal(failureFromStatus(0), 'offline');
  assert.match(serviceNotice('unauthorized', 'alerts').description, /401/);
  assert.doesNotMatch(serviceNotice('unauthorized', 'alerts').description, /not connected/i);
  assert.match(serviceNotice('missing', 'alerts').description, /404/);
  assert.doesNotMatch(serviceNotice('missing', 'alerts').description, /not connected/i);
  assert.match(serviceNotice('offline', 'alerts').description, /network/i);
});
