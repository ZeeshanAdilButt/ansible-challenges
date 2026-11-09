// The capstone rubric, as code. A mentor reads the same list in RUBRIC-FOR-MENTORS.md.
//
// Six areas: fleet configured, idempotence and tests, secrets, rollout safety, recovery, evidence and communication.
// 100 points: 70 are AUTOMATED (the criterion reads facts that the parts measured on your fleet) and 30 are for the MENTOR
// (they need your written defence and a conversation). A criterion has its points, the part that measures it and a hint.
//
// Pass mark: 56 of the 70 automated points (80 %) to book the review, and 80 of 100 after the mentor has scored the 30.
// Each part's test.mjs runs the criteria of that part. Part 4's test.mjs runs the last ones and prints the score.

import { getFact } from '../../toolkit/facts.js';

export const TARGETS = {
  recover_s: 60, // from the stop of the rollout to a green health check, measured by the script (not the time you spend reading)
  defence_words: [300, 800],
  automated_pass_percent: 80,
};

export const AREAS = ['fleet configured', 'idempotence and tests', 'secrets', 'rollout safety', 'recovery', 'evidence and communication'];

const fact = (part, name) => getFact(`c10.p${part}.${name}`);
const missing = (part, names) => names.filter((n) => fact(part, n) === undefined);
const ok = (cond, msg) => (cond ? true : msg);

/**
 * check() returns true when the criterion is met, or a string that says what is wrong.
 * "needs" lists the facts it reads: if one is missing, the part has not been run yet.
 * A criterion with mentor: true has no check(): the mentor scores it, "ask" says what the mentor looks at.
 */
export const CRITERIA = [
  // ---- part 1: configure ----
  { id: 'p1.converge', part: 1, area: 'fleet configured', points: 6, title: 'site.yml configures all three hosts with no failed task', hint: 'Run ci.mjs and read the first red line. Each role needs its packages, its config and its service.',
    needs: ['first_run_failed_count', 'hosts_ok_count'],
    check: () => ok(fact(1, 'first_run_failed_count') === 0 && fact(1, 'hosts_ok_count') === 3, `${fact(1, 'hosts_ok_count')} of 3 hosts finished without a failure (${fact(1, 'first_run_failed_count')} failed)`) },
  { id: 'p1.proxy', part: 1, area: 'fleet configured', points: 4, title: 'a request to the proxy reaches the app and the app reaches the database', hint: 'GET http://web1/health must answer 200 with db "ok". Check the proxy_pass line and the app port.',
    needs: ['health_status', 'health_app_status', 'health_db'],
    check: () => ok(fact(1, 'health_status') === 200 && fact(1, 'health_app_status') === 'ok' && fact(1, 'health_db') === 'ok', `proxy health: status ${fact(1, 'health_status')}, app ${fact(1, 'health_app_status')}, db ${fact(1, 'health_db')}`) },
  { id: 'p1.db-auth', part: 1, area: 'fleet configured', points: 1, title: 'redis refuses a client that has no password', hint: 'requirepass {{ db_password }} in redis.conf.j2.',
    needs: ['db_requires_password'],
    check: () => ok(fact(1, 'db_requires_password') === true, 'redis answered a PING without a password') },
  { id: 'p1.app-user', part: 1, area: 'fleet configured', points: 1, title: 'the app does not run as root', hint: 'The role makes a system user and the init script starts the app as that user.',
    needs: ['app_user_nonroot'],
    check: () => ok(fact(1, 'app_user_nonroot') === true, `the app runs as ${fact(1, 'app_user')}`) },
  { id: 'p1.pins', part: 1, area: 'fleet configured', points: 3, title: 'requirements.yml pins every collection to one exact version, and a role uses it', hint: 'version: "13.0.0", not ">=13" and not "*". Call a module of the collection by its full name.',
    needs: ['collection_pinned', 'collection_used_count'],
    check: () => ok(fact(1, 'collection_pinned') === true && fact(1, 'collection_used_count') >= 1, `pinned exactly: ${fact(1, 'collection_pinned')}, used in ${fact(1, 'collection_used_count')} place(s)`) },

  { id: 'p1.lint', part: 1, area: 'idempotence and tests', points: 3, title: 'ansible-lint and the syntax check pass', hint: 'node toolkit/ansible.mjs ansible-lint in the stack folder, and fix each rule it names.',
    needs: ['lint_ok', 'syntax_ok'],
    check: () => ok(fact(1, 'lint_ok') === true && fact(1, 'syntax_ok') === true, `lint ${fact(1, 'lint_ok')}, syntax ${fact(1, 'syntax_ok')}`) },
  { id: 'p1.idempotent', part: 1, area: 'idempotence and tests', points: 7, title: 'the second run of site.yml changes nothing (changed=0 on all three hosts)', hint: 'Run site.yml with -v and find the task that says changed on a second run. Use state, creates, changed_when.',
    needs: ['second_run_changed_count', 'second_run_hosts_count'],
    check: () => ok(fact(1, 'second_run_changed_count') === 0 && fact(1, 'second_run_hosts_count') === 3, `the second run changed ${fact(1, 'second_run_changed_count')} task(s) on ${fact(1, 'second_run_hosts_count')} hosts`) },
  { id: 'p1.check', part: 1, area: 'idempotence and tests', points: 3, title: 'check mode on the finished fleet runs without a failure and finds no drift', hint: 'Run ci.mjs --only check and read what it would change. A task that always reports changed shows up here too.',
    needs: ['check_ok', 'check_changed_count'],
    check: () => ok(fact(1, 'check_ok') === true && fact(1, 'check_changed_count') === 0, `check mode ok: ${fact(1, 'check_ok')}, it would change ${fact(1, 'check_changed_count')} task(s)`) },
  { id: 'p1.stages', part: 1, area: 'idempotence and tests', points: 1, title: 'all seven stages of ci.mjs pass in order', hint: 'node challenges/challenge-10-capstone/capstone-stack/ci.mjs',
    needs: ['stages_ok_count', 'stages_total_count'],
    check: () => ok(fact(1, 'stages_ok_count') === 7 && fact(1, 'stages_total_count') === 7, `${fact(1, 'stages_ok_count')} of ${fact(1, 'stages_total_count')} stages passed`) },

  { id: 'p1.vault', part: 1, area: 'secrets', points: 2, title: 'the database password is in an encrypted vault file', hint: 'ansible-vault encrypt group_vars/all/vault.yml. The file must start with $ANSIBLE_VAULT.',
    needs: ['vault_encrypted', 'vault_secrets_count'],
    check: () => ok(fact(1, 'vault_encrypted') === true && fact(1, 'vault_secrets_count') >= 1, `encrypted: ${fact(1, 'vault_encrypted')}, secrets in it: ${fact(1, 'vault_secrets_count')}`) },
  { id: 'p1.no-plain', part: 1, area: 'secrets', points: 2, title: 'the password is in no other file of the stack', hint: 'Roles and group_vars read {{ db_password }}. They never contain the value.',
    needs: ['secret_in_files_count'],
    check: () => ok(fact(1, 'secret_in_files_count') === 0, `the secret appears ${fact(1, 'secret_in_files_count')} time(s) in plain files`) },
  { id: 'p1.no-leak', part: 1, area: 'secrets', points: 3, title: 'nothing Ansible printed (check with --diff, apply, second run) shows the password', hint: 'diff: false on a template that holds the secret; no_log: true on a task that is given it.',
    needs: ['secret_in_output_count'],
    check: () => ok(fact(1, 'secret_in_output_count') === 0, `the secret appears ${fact(1, 'secret_in_output_count')} time(s) in the output`) },
  { id: 'p1.ignore', part: 1, area: 'secrets', points: 1, title: '.vault-pass is git-ignored', hint: 'git check-ignore challenges/challenge-10-capstone/capstone-stack/.vault-pass must print the path.',
    needs: ['vault_pass_ignored'],
    check: () => ok(fact(1, 'vault_pass_ignored') === true, '.vault-pass is not ignored by git') },
  { id: 'm.secrets', part: 4, area: 'secrets', points: 4, mentor: true, title: 'explains where the vault password lives, how CI gets it, and what to do if it leaks',
    ask: 'Ask: where is the vault password, who has it, how does the workflow get it, and what do you change if it leaked? A good answer names a CI secret, says the password never enters the repository, and says to re-encrypt and rotate the database password too.' },

  // ---- part 2: break it ----
  { id: 'p2.serial', part: 2, area: 'rollout safety', points: 3, title: 'the rollout changes one host at a time (batches 1,1,1)', hint: 'serial: 1 on the play. Read the batch sizes in results.md.',
    needs: ['good_batch_sizes'],
    check: () => ok(fact(2, 'good_batch_sizes') === '1,1,1', `batch sizes were ${fact(2, 'good_batch_sizes')}`) },
  { id: 'p2.good', part: 2, area: 'rollout safety', points: 2, title: 'a good rollout reaches all three hosts and the proxy then reports release 2', hint: 'vars_files: vars/release-2.yml and the import of tasks/release.yml.',
    needs: ['good_failed_count', 'good_changed_count', 'good_release'],
    check: () => ok(fact(2, 'good_failed_count') === 0 && fact(2, 'good_changed_count') === 3 && fact(2, 'good_release') === '2', `failed ${fact(2, 'good_failed_count')}, changed ${fact(2, 'good_changed_count')}, release now ${fact(2, 'good_release')}`) },
  { id: 'p2.stop', part: 2, area: 'rollout safety', points: 4, title: 'a bad change stops the rollout: one host failed, at most one changed before it, and one host was never touched', hint: 'Batches of one host stop on their own when a host fails. Run the part again and read which hosts ran.',
    needs: ['bad_failed_count', 'bad_untouched_count', 'bad_changed_before_stop_count'],
    check: () => ok(fact(2, 'bad_failed_count') === 1 && fact(2, 'bad_untouched_count') >= 1 && fact(2, 'bad_changed_before_stop_count') <= 1, `failed ${fact(2, 'bad_failed_count')}, changed before the stop ${fact(2, 'bad_changed_before_stop_count')}, untouched ${fact(2, 'bad_untouched_count')}`) },
  { id: 'p2.explicit', part: 2, area: 'rollout safety', points: 2, title: 'rollout.yml says in words that a failure stops the rollout (any_errors_fatal or max_fail_percentage), not only through the batch size', hint: 'With serial: 1 the play stops because the whole batch failed. With serial: 2 it would not. Add any_errors_fatal: true or max_fail_percentage so the rule survives a change of batch size.',
    needs: ['rollout_stop_keyword'],
    check: () => ok(fact(2, 'rollout_stop_keyword') !== 'none', 'rollout.yml has no any_errors_fatal and no max_fail_percentage') },
  { id: 'm.design', part: 4, area: 'rollout safety', points: 7, mentor: true, title: 'explains what stopped the rollout with batches of one, and what would not stop it with batches of two',
    ask: 'Look at the drills in results.md of part 2. With serial: 1 alone the play ended, because the only host of the batch failed. With serial: 2 alone the failed host was dropped and the next batch still ran. any_errors_fatal and max_fail_percentage stop it in both. The learner should say that, and say why the keyword belongs in the file even with batches of one (max_fail_percentage is a share of the batch).' },
  { id: 'm.blast', part: 4, area: 'rollout safety', points: 3, mentor: true, title: 'says what was changed and what was not when the rollout stopped, from the numbers',
    ask: 'Ask for the three numbers of part 2 (changed before the stop, failed, untouched) and what state each host was left in. The proxy host had the new release, the app host was broken, the database host was untouched.' },

  // ---- part 3: recover it ----
  { id: 'p3.recovered', part: 3, area: 'recovery', points: 4, title: 'after the recovery the proxy answers 200 with the app and database behind it', hint: 'recover.yml must put the known-good release back and wait for the health check.',
    needs: ['recovered', 'recover_health_status'],
    check: () => ok(fact(3, 'recovered') === true && fact(3, 'recover_health_status') === 200, `recovered ${fact(3, 'recovered')}, health ${fact(3, 'recover_health_status')}`) },
  { id: 'p3.zero', part: 3, area: 'recovery', points: 3, title: 'after the recovery, site.yml reports changed=0 on every host', hint: 'The recovery must end in the state site.yml describes. Run site.yml and read what it still changes.',
    needs: ['zero_after_recover_changed_count'],
    check: () => ok(fact(3, 'zero_after_recover_changed_count') === 0, `site.yml still changes ${fact(3, 'zero_after_recover_changed_count')} task(s) after the recovery`) },
  { id: 'p3.consistent', part: 3, area: 'recovery', points: 1, title: 'every host is back on release 1 (the proxy header and the app agree)', hint: 'The host that was changed before the stop (the proxy) must go back too.',
    needs: ['release_after_recover', 'proxy_release_after_recover'],
    check: () => ok(fact(3, 'release_after_recover') === '1' && fact(3, 'proxy_release_after_recover') === '1', `app says release ${fact(3, 'release_after_recover')}, proxy header says ${fact(3, 'proxy_release_after_recover')}`) },
  { id: 'p3.time', part: 3, area: 'recovery', points: 2, title: `the script recovers in ${TARGETS.recover_s} seconds or less (median of three, stop to green check)`, hint: 'Run only what must run: no full gather on hosts you do not touch, no long retries.',
    needs: ['recover_s'],
    check: () => ok(fact(3, 'recover_s') <= TARGETS.recover_s, `median ${fact(3, 'recover_s')} s, the target is ${TARGETS.recover_s} s`) },
  { id: 'm.runbook-use', part: 4, area: 'recovery', points: 5, mentor: true, title: 'RUNBOOK.md would work for a stranger at 3 am',
    ask: 'Pick one entry and run its Check commands on the fleet while it is broken (node toolkit/ansible.mjs). Do they show the symptom? Does the Fix bring the fleet back? Is the Prevention a real setting?' },

  // ---- part 3 and 4: evidence and communication ----
  { id: 'p3.runbook', part: 3, area: 'evidence and communication', points: 3, title: 'RUNBOOK.md has an entry for the stopped rollout and one for the 502, with symptom, check, cause, fix, prevention', hint: 'Use the template at the top of RUNBOOK.md. Each field needs words, each Check needs a command in backticks.',
    needs: ['runbook_entries_count', 'runbook_complete_count'],
    check: () => ok(fact(3, 'runbook_entries_count') === 2 && fact(3, 'runbook_complete_count') === 2, `${fact(3, 'runbook_complete_count')} of 2 entries are complete (${fact(3, 'runbook_entries_count')} found)`) },
  { id: 'p3.evidence', part: 3, area: 'evidence and communication', points: 2, title: 'the runbook quotes the numbers your own run measured', hint: 'Each entry has a "Measured:" line with a number from results.md or facts.',
    needs: ['runbook_numbers_match'],
    check: () => ok(fact(3, 'runbook_numbers_match') === true, 'a Measured: number does not match what your run measured') },
  { id: 'p4.defence', part: 4, area: 'evidence and communication', points: 3, title: 'DEFENCE.md is a five-minute demo outline with all five sections and 300 to 800 words', hint: 'Sections: The fleet, The pipeline, The rollout, The failure and the recovery, At ten times the fleet.',
    needs: ['defence_words_count', 'defence_sections_count'],
    check: () => ok(fact(4, 'defence_sections_count') === 5 && fact(4, 'defence_words_count') >= TARGETS.defence_words[0] && fact(4, 'defence_words_count') <= TARGETS.defence_words[1], `${fact(4, 'defence_sections_count')} of 5 sections, ${fact(4, 'defence_words_count')} words`) },
  { id: 'p4.numbers', part: 4, area: 'evidence and communication', points: 2, title: 'the demo quotes at least five numbers from your own facts', hint: 'Seconds per stage, hosts changed before the stop, minutes to recover. They must match what you measured.',
    needs: ['defence_numbers_matched_count'],
    check: () => ok(fact(4, 'defence_numbers_matched_count') >= 5, `${fact(4, 'defence_numbers_matched_count')} of your numbers appear in the demo`) },
  { id: 'p4.questions', part: 4, area: 'evidence and communication', points: 2, title: 'DEFENCE.md answers the three questions and the troubleshooting question, each in 60 to 200 words and on the point', hint: 'Answer what was asked, name the command or the file, say what you would change.',
    needs: ['questions_ok_count', 'questions_total_count'],
    check: () => ok(fact(4, 'questions_ok_count') === 4 && fact(4, 'questions_total_count') === 4, `${fact(4, 'questions_ok_count')} of ${fact(4, 'questions_total_count')} answers are good enough`) },
  { id: 'm.defence-true', part: 4, area: 'evidence and communication', points: 6, mentor: true, title: 'the five-minute demo is true: every claim can be checked live',
    ask: 'Let the learner give the demo. Ask them to show one claim live (for example the second run says changed=0, or the 502 and the recovery). The numbers they say must be the numbers in facts.json.' },
  { id: 'm.questions', part: 4, area: 'evidence and communication', points: 5, mentor: true, title: 'answers the follow-up questions with a command or a file, not with a slogan',
    ask: 'Ask one to three follow-ups, for example: what would you change to roll out to 300 hosts? what if the failed host were the database? how do you know a check-mode run is honest? A good answer names a keyword, a module or a file.' },
];

/** Evaluate one criterion: { status: 'pass' | 'fail' | 'mentor' | 'not run', detail }. */
export function evaluate(c) {
  if (c.mentor) return { status: 'mentor', detail: c.ask };
  const absent = missing(c.part, c.needs);
  if (absent.length) return { status: 'not run', detail: `c10.p${c.part}.${absent[0]} is missing: run the part first` };
  const r = c.check();
  return r === true ? { status: 'pass', detail: '' } : { status: 'fail', detail: String(r) };
}

/** Score the rubric from the saved facts. Mentor criteria are listed with their points and are not part of the automated score. */
export function score(parts = [1, 2, 3, 4]) {
  const rows = CRITERIA.filter((c) => parts.includes(c.part)).map((c) => ({ ...c, ...evaluate(c) }));
  const auto = rows.filter((r) => !r.mentor);
  const mentor = rows.filter((r) => r.mentor);
  const sum = (list) => list.reduce((a, r) => a + r.points, 0);
  const earned = sum(auto.filter((r) => r.status === 'pass'));
  const available = sum(auto);
  const byArea = Object.fromEntries(AREAS.map((a) => [a, {
    earned: sum(auto.filter((r) => r.area === a && r.status === 'pass')),
    available: sum(auto.filter((r) => r.area === a)),
    mentor: sum(mentor.filter((r) => r.area === a)),
  }]));
  return { rows, earned, available, percent: available ? Math.round((earned / available) * 100) : 0, mentorPoints: sum(mentor), failing: auto.filter((r) => r.status !== 'pass'), byArea };
}
