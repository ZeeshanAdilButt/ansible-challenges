// Part 1 test. Run: node --test challenges/challenge-10-capstone/part-1-configure/test.mjs
// It reads the numbers run.mjs saved, one test for each rubric line of this part. The first run fails on purpose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fleetRunning } from '../../../toolkit/fleet.mjs';
import { get } from '../capstone-stack/ci.mjs';
import { rubricTests } from '../rubric-tests.mjs';

const here = dirname(fileURLToPath(import.meta.url));
rubricTests(1, here, 'Run: node challenges/challenge-10-capstone/part-1-configure/run.mjs');

const fleetUp = ['control', 'web1', 'web2', 'db1'].every((s) => fleetRunning().includes(s));

test('live: the fleet is running and the proxy answers 200 with the database behind it', { skip: !fleetUp && 'The fleet is not running. Start it: node toolkit/fleet.mjs up' }, () => {
  const r = get('http://web1/health');
  assert.equal(r.status, 200, `GET http://web1/health answered ${r.status}. Run part 1 again: node challenges/challenge-10-capstone/part-1-configure/run.mjs`);
  assert.equal(JSON.parse(r.body).db, 'ok');
});
