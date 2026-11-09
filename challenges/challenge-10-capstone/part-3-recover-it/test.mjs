// Part 3 test. Run: node --test challenges/challenge-10-capstone/part-3-recover-it/test.mjs
// It reads the numbers run.mjs saved, one test for each rubric line of this part. The first run fails on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fleetRunning } from '../../../toolkit/fleet.mjs';
import { get } from '../capstone-stack/ci.mjs';
import { rubricTests } from '../rubric-tests.mjs';

const here = dirname(fileURLToPath(import.meta.url));
rubricTests(3, here, 'Run: node challenges/challenge-10-capstone/part-3-recover-it/run.mjs');

const fleetUp = ['control', 'web1', 'web2', 'db1'].every((s) => fleetRunning().includes(s));

test('live: the fleet is healthy on release 1 now', { skip: !fleetUp && 'The fleet is not running. Start it: node toolkit/fleet.mjs up' }, () => {
  const r = get('http://web1/health');
  assert.equal(r.status, 200, `The proxy answers ${r.status}. Run part 3 again: node challenges/challenge-10-capstone/part-3-recover-it/run.mjs`);
  assert.equal(JSON.parse(r.body).release, '1');
});
