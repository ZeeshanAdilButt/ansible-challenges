// Challenge 10, part 4: defend it. Check your DEFENCE.md, then score the whole capstone.
// Run: node challenges/challenge-10-capstone/part-4-defend-it/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to run against the reference DEFENCE.md (for maintainers).
//
// No Docker needed: it reads DEFENCE.md, compares your numbers with facts.json (the numbers parts 1 to 3 measured on your
// machine), and prints the rubric table. 70 of the 100 points are automated. The mentor scores the other 30.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Recorder } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { AREAS, score } from '../rubric.mjs';
import { clearFacts, clip, closeStack, openStack, saveFacts, showLearnerPaths, text } from '../lib.mjs';
import { checkDefence, checkQuestions } from './check.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const rec = showLearnerPaths(new Recorder('Challenge 10, part 4: defend it'));
const facts = {};
const f = (name, v) => (facts[`c10.p4.${name}`] = v);
const pad = (s, n) => String(s).padEnd(n);

let S;
try {
  S = await openStack();
  clearFacts('c10.p4.');
  const doc = text(S, 'DEFENCE.md');
  if (!doc.trim()) throw new Error('capstone-stack/DEFENCE.md is missing. It is part of the starter: copy it back from the template.');

  // Step 1: the demo outline.
  const d = checkDefence(doc);
  f('defence_words_count', d.words);
  f('defence_sections_count', d.sections);
  f('defence_numbers_matched_count', d.matched.length);
  f('defence_numbers_possible_count', d.possible);
  rec.step(
    'read DEFENCE.md: the five sections of the demo, the words, and the numbers followed by a unit that match facts.json',
    [
      `sections found: ${d.sections} of 5   words: ${d.words} (about ${Math.round((d.words / 150) * 10) / 10} minutes at 150 words a minute; the range is 300 to 800)`,
      `numbers quoted from your own facts: ${d.matched.length} of ${d.possible} that could be quoted`,
      ...d.matched.map((m) => `  ${m}`),
    ].join('\n'),
    d.sections === 5 && d.words >= 300 && d.words <= 800 && d.matched.length >= 5 ? 'The shape is right and the numbers are yours. A mentor will check that the words are true.' : 'Not finished: five sections, 300 to 800 words, at least five numbers from your own run, each with its unit.',
  );

  // Step 2: the questions.
  const q = checkQuestions(doc);
  f('questions_total_count', q.length);
  f('questions_ok_count', q.filter((p) => p.ok).length);
  rec.step(
    'read DEFENCE.md: three questions and one troubleshooting question, 60 to 200 words each, each on the point',
    q.map((p) => `${pad(p.heading, 16)} ${String(p.words).padStart(3)} words  ${p.ok ? 'ok' : `NOT YET: ${p.problems.join('; ')}`}`).join('\n'),
    facts['c10.p4.questions_ok_count'] === q.length ? 'Each answer is the right length and names the ideas the question is about. The mentor decides whether it is good.' : 'Read the question again, and answer what it asks. Name the keyword, the command or the file.',
  );

  saveFacts(facts);

  // Step 3: the whole rubric.
  const s = score();
  const lines = s.rows.map((r) => `${pad(r.mentor ? 'mentor' : r.status, 8)} ${String(r.points).padStart(2)}  ${pad(r.area, 27)} ${r.title.slice(0, 74)}${r.status === 'fail' || r.status === 'not run' ? `\n           -> ${r.detail}` : ''}`);
  rec.step('score the rubric from facts.json: one line for each criterion', clip(lines.join('\n'), 40), `Automated: ${s.earned} of ${s.available} points, ${s.percent} %. The pass mark for the review is 80 %. The mentor scores another ${s.mentorPoints} points.`);
  rec.step(
    'the score for each area',
    AREAS.map((a) => `${pad(a, 28)} ${String(s.byArea[a].earned).padStart(3)} of ${String(s.byArea[a].available).padStart(3)} automated, ${String(s.byArea[a].mentor).padStart(2)} for the mentor`).join('\n'),
    'A mentor reads the same six areas in under 45 minutes (RUBRIC-FOR-MENTORS.md), then asks one to three follow-up questions.',
  );
  f('rubric_percent', s.percent);
  f('rubric_points_earned', s.earned);
  f('rubric_points_available', s.available);
  f('rubric_mentor_points', s.mentorPoints);
  saveFacts(facts);

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Node ${process.versions.node}${S.reference ? '. The maintainer run used the reference DEFENCE.md' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'Automated rubric points earned by area (of the points available)',
        unit: 'points',
        bars: AREAS.map((a) => ({ label: `${a} (of ${s.byArea[a].available})`, value: s.byArea[a].earned })),
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
  console.log(`\nRubric: ${s.earned} of ${s.available} automated points, ${s.percent} %. Pass mark 80 %. The mentor scores ${s.mentorPoints} more.`);
  console.log('See your numbers with: node toolkit/show-facts.mjs c10.p4');
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  closeStack(S);
}
