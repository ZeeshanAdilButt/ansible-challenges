// Challenge 7, part 1: lint a sloppy playbook and role, then fix it to a profile.
// Run: node challenges/challenge-7-test-your-role/part-1-lint-to-a-profile/run.mjs
// Add --record to also write results.md and chart.svg next to this file.
// Add --reference to lint reference/fix-me instead of your fix-me (for maintainers).

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDocker, cleanup, leftovers } from '../../../toolkit/docker.js';
import { setFact } from '../../../toolkit/facts.js';
import { Recorder } from '../../../toolkit/record.js';
import { barsSvg } from '../../../toolkit/bars.js';
import { round } from '../../../toolkit/stats.js';
import { fleetReset } from '../../../toolkit/fleet.mjs';
import { ansible } from '../../../toolkit/ansible.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const record = process.argv.includes('--record');
const reference = process.argv.includes('--reference');
const rec = new Recorder('Challenge 7, part 1: lint to a profile');
const CHALLENGE = 7;
const PART = 'challenges/challenge-7-test-your-role/part-1-lint-to-a-profile';
const SLOPPY = `${PART}/sloppy`;
const MINE = `${PART}/${reference ? 'reference/' : ''}fix-me`;
const PROFILES = ['min', 'basic', 'moderate', 'safety', 'shared', 'production'];
const shown = (t) => t.replaceAll('/reference/fix-me', '/fix-me');

let engine;
try {
  engine = assertDocker();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

/** ansible-lint in a folder. JSON findings on stdout, the summary on stderr. */
function lint(folder, profile) {
  const args = ['ansible-lint', ...(profile ? ['--profile', profile] : []), 'site.yml'];
  const text = ansible(args, { cwd: folder });
  const json = ansible(['ansible-lint', '-f', 'json', ...(profile ? ['--profile', profile] : []), 'site.yml'], { cwd: folder, merge: false });
  let findings;
  try {
    findings = JSON.parse(json.stdout);
  } catch {
    throw new Error(`ansible-lint printed no JSON for ${folder}:\n${json.stdout}\n${json.stderr}`);
  }
  return { code: text.code, text: text.stdout, findings };
}
const lastProfile = (text) => (text.match(/Last profile that met the validation criteria was '(\w+)'/) || text.match(/Profile '\w+' was required, and it passed|(production) profile passed/) || [])[1] ?? (/was required, and it passed/.test(text) ? 'passed' : 'none');
/** From the output of ansible-lint -P: "profile  rule" for each listed rule that was hit (name[casing] by its own entry, name[missing] by the family name). */
const profileList = (text, hit) => {
  const rows = [];
  let profile = '';
  for (const l of text.split('\n')) {
    const h = l.match(/^## (\w+)/);
    if (h) profile = h[1];
    const m = l.match(/^- \[([^\]]+\]?)\]\(/);
    if (m && profile && hit.some((r) => r === m[1] || r.split('[')[0] === m[1])) rows.push(`${profile.padEnd(11)} ${m[1]}`);
  }
  return rows.join('\n');
};
const rules = (findings) => {
  const c = {};
  for (const f of findings) c[f.check_name] = (c[f.check_name] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => `${String(v).padStart(3)}  ${k}`).join('\n');
};

try {
  cleanup(CHALLENGE);
  const resetS = await fleetReset();
  console.log(`Fleet ready in ${round(resetS, 1)} s`);

  // 1. The sloppy playbook and role, default settings.
  const before = lint(SLOPPY, '');
  const lines = before.text.split('\n');
  const keep = lines.slice(0, 18).join('\n');
  rec.step(`node toolkit/ansible.mjs ansible-lint ${SLOPPY}/site.yml   (first 18 lines of the output)`, `${keep}\n...`, `ansible-lint printed ${before.findings.length} findings and exited with code ${before.code}. Each line starts with the rule name, for example fqcn[action-core].`);
  rec.step(`node toolkit/ansible.mjs ansible-lint -f json ${SLOPPY}/site.yml   (findings counted per rule)`, rules(before.findings), 'The same findings as JSON, counted per rule. A tool can read this format, for example a pipeline.');
  // The summary has one line per rule family with its count, profile and tags. The lines start with spaces, so match the trimmed line.
  const isRuleLine = (l) => /^\d+ [\w-]+ profile:\w+/.test(l.trim());
  const summaryRules = before.text.split('\n').filter(isRuleLine);
  const summary = before.text.split('\n').filter((l) => /^(Failed|Passed)/.test(l.trim()) || /Rule Violation Summary/.test(l) || isRuleLine(l)).join('\n');
  rec.step(`node toolkit/ansible.mjs ansible-lint ${SLOPPY}/site.yml   (the summary at the end)`, summary, `The summary lists each rule family with its count, the profile it prints and its tags. The last line names the highest profile that passed: '${lastProfile(before.text)}'.`);

  // 2. Findings per profile.
  const perProfile = {};
  for (const p of PROFILES) perProfile[p] = lint(SLOPPY, p);
  rec.step(`node toolkit/ansible.mjs ansible-lint --profile <name> ${SLOPPY}/site.yml   (six runs, counts from -f json)`, PROFILES.map((p) => `${p.padEnd(11)} ${String(perProfile[p].findings.length).padStart(3)} findings   exit code ${perProfile[p].code}`).join('\n'), 'A profile is a set of rules. Each profile includes the one before it, so the count can only stay or go up: min, basic, moderate, safety, shared, production.');
  // Which profile does each rule belong to? The first profile whose run reports the rule. This is measured, and it agrees with
  // `ansible-lint -P`. The profile word printed in the summary above is the same for every line, so it is not used for this.
  const ruleProfile = {};
  for (const f of perProfile.production.findings) {
    ruleProfile[f.check_name] ??= PROFILES.find((p) => perProfile[p].findings.some((g) => g.check_name === f.check_name));
  }
  const ruleList = Object.keys(ruleProfile).sort((a, b) => PROFILES.indexOf(ruleProfile[a]) - PROFILES.indexOf(ruleProfile[b]) || a.localeCompare(b));
  const ruleProfiles = ruleList.map((r) => `${r}:${ruleProfile[r]}`).join(',');
  rec.step(`node toolkit/ansible.mjs ansible-lint -f json --profile <name> ${SLOPPY}/site.yml   (the first profile whose run reports each rule)`, ruleList.map((r) => `${ruleProfile[r].padEnd(11)} ${r}`).join('\n'), 'Which rule belongs to which profile: the lowest profile whose run reports the rule. The rule also shows up in every stricter profile. The word after "profile:" in the summary of the default run is the same for every line, so it cannot be used for this.');
  const listed = ansible(['ansible-lint', '-P']).stdout;
  rec.step('node toolkit/ansible.mjs ansible-lint -P   (cut down to the rules this code hit)', profileList(listed, ruleList), 'ansible-lint prints its own list of profiles and rules. Cut down to the rules the sloppy code hit, it shows the same profile for each rule as the table above (name[missing] and name[play] are covered by the family name).');
  rec.step(`node toolkit/ansible.mjs ansible-lint --profile min ${SLOPPY}/site.yml`, perProfile.min.text.trim().split('\n').slice(-3).join('\n'), "With --profile min the sloppy code passes: min only checks that Ansible can load the files. Its last line says production passed, which is not what it checked (see NOTES.md).");

  // 3. Your fixed copy, at the stated profile.
  const fixedProd = lint(MINE, 'production');
  rec.step(shown(`node toolkit/ansible.mjs ansible-lint --profile production ${MINE}/site.yml`), shown(fixedProd.text.trim().split('\n').slice(-6).join('\n')), `Your copy: ${fixedProd.findings.length} findings at production, exit code ${fixedProd.code}.`);
  const fixedDefault = lint(MINE, '');
  const highest = lastProfile(fixedDefault.text);
  rec.step(shown(`node toolkit/ansible.mjs ansible-lint ${MINE}/site.yml`), shown(fixedDefault.text.trim().split('\n').slice(-3).join('\n')), `With every rule on, the highest profile your copy passes is '${highest}'.`);

  const facts = {
    'c7.p1.findings_default': before.findings.length,
    'c7.p1.findings_fixed': fixedProd.findings.length,
    'c7.p1.highest_profile': highest,
    'c7.p1.highest_profile_before': lastProfile(before.text),
    'c7.p1.findings_min': perProfile.min.findings.length,
    'c7.p1.findings_basic': perProfile.basic.findings.length,
    'c7.p1.findings_moderate': perProfile.moderate.findings.length,
    'c7.p1.findings_safety': perProfile.safety.findings.length,
    'c7.p1.findings_shared': perProfile.shared.findings.length,
    'c7.p1.findings_production': perProfile.production.findings.length,
    'c7.p1.rule_profiles': ruleProfiles,
    'c7.p1.summary_profile_labels': summaryRules.map((l) => l.trim().replace(/^\d+ ([\w-]+) profile:(\w+).*/, '$1:$2')).join(','),
    'c7.p1.rules_hit_before': new Set(before.findings.map((f) => f.check_name)).size,
    'c7.p1.fix_file': `${MINE}/site.yml`,
  };
  for (const [k, v] of Object.entries(facts)) setFact(k, v);

  const left = leftovers(CHALLENGE);
  if (left.containers + left.networks + left.volumes !== 0) throw new Error('objects with our label are left over');

  if (record) {
    rec.write(join(here, 'results.md'), `${process.platform}, Docker Engine ${engine}, Node ${process.versions.node}${reference ? '. The maintainer run linted reference/fix-me; the paths below show fix-me' : ''}`);
    writeFileSync(
      join(here, 'chart.svg'),
      barsSvg({
        title: 'ansible-lint findings per profile, and after the fix',
        unit: 'findings',
        bars: [...PROFILES.map((p) => ({ label: p, value: perProfile[p].findings.length })), { label: 'fixed, production', value: fixedProd.findings.length }],
      }),
    );
    console.log('\nWrote results.md and chart.svg');
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  cleanup(CHALLENGE);
}
