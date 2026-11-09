// Turns the criteria of one part into node:test tests, so the rubric is a test suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { leftovers, run } from '../../toolkit/docker.js';
import { CRITERIA, evaluate, score } from './rubric.mjs';

export function rubricTests(part, partDir, runHint) {
  for (const c of CRITERIA.filter((x) => x.part === part)) {
    test(`${c.area}: ${c.title} (${c.points} points${c.mentor ? ', for the mentor' : ''})`, (t) => {
      const r = evaluate(c);
      if (r.status === 'mentor') return t.skip('scored by the mentor in the review');
      if (r.status === 'not run') assert.fail(`${r.detail}. ${runHint}`);
      assert.equal(r.status, 'pass', `${r.detail}. How: ${c.hint}`);
    });
  }

  if (part === 4) {
    test('the whole rubric: 80 percent or more of the 70 automated points', () => {
      const s = score();
      const failing = s.failing.map((r) => `  - ${r.id}: ${r.detail}`);
      console.log(`Rubric score: ${s.earned} of ${s.available} automated points, ${s.percent} percent. The mentor scores another ${s.mentorPoints}.`);
      assert.ok(s.percent >= 80, `Score ${s.percent} percent. Still failing:\n${failing.join('\n')}`);
    });
  }

  test('chart.svg is an accessible chart and the README links the safety rules', () => {
    const svg = readFileSync(join(partDir, 'chart.svg'), 'utf8');
    assert.match(svg, /role="img"/);
    assert.match(svg, /<desc id="d">/);
    const readme = readFileSync(join(partDir, 'README.md'), 'utf8');
    assert.match(readme, /\(\.\.\/\.\.\/\.\.\/SAFETY\.md\)/);
  });

  test('live: the run cleaned up after itself', { skip: run(['version']).code !== 0 && 'Docker is not running' }, () => {
    assert.deepEqual(leftovers(10), { containers: 0, networks: 0, volumes: 0 }, 'Something labelled anp.challenge=10 is still there. Run: node toolkit/cleanup.mjs 10');
  });
}
