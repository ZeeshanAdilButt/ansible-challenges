// The ladder: eighteen places where the variable app_port can be set, in the order that the
// Ansible documentation lists them, weakest first. render() writes a small project with only
// the places you switch on. Every place sets app_port to its own name, so the output tells
// you which place won.
//
// Docs: Using variables, "Understanding variable precedence".

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// id: the value app_port gets. label: what it is. docs: the line in the documentation's list.
export const SOURCES = [
  { id: 'role-defaults', label: 'role defaults (roles/appconf/defaults/main.yml)', docs: 'Role defaults' },
  { id: 'inventory-group-var', label: 'inventory file group var ([web:vars])', docs: 'Inventory file or script group vars' },
  { id: 'inventory-group_vars-all', label: 'inventory group_vars/all', docs: 'Inventory group_vars/all' },
  { id: 'playbook-group_vars-all', label: 'playbook group_vars/all', docs: 'Playbook group_vars/all' },
  { id: 'inventory-group_vars-web', label: 'inventory group_vars/web', docs: 'Inventory group_vars/*' },
  { id: 'playbook-group_vars-web', label: 'playbook group_vars/web', docs: 'Playbook group_vars/*' },
  { id: 'inventory-host-var', label: 'inventory file host var (web2 app_port=...)', docs: 'Inventory file or script host vars', hosts: ['web2'] },
  { id: 'inventory-host_vars-web2', label: 'inventory host_vars/web2', docs: 'Inventory host_vars/*', hosts: ['web2'] },
  { id: 'playbook-host_vars-web2', label: 'playbook host_vars/web2', docs: 'Playbook host_vars/*', hosts: ['web2'] },
  { id: 'play-vars', label: 'play vars:', docs: 'Play vars' },
  { id: 'play-vars_files', label: 'play vars_files:', docs: 'Play vars_files' },
  { id: 'role-vars', label: 'role vars (roles/appconf/vars/main.yml)', docs: 'Role vars' },
  { id: 'block-vars', label: 'block vars:', docs: 'Block vars' },
  { id: 'task-vars', label: 'task vars:', docs: 'Task vars' },
  { id: 'include_vars', label: 'include_vars task', docs: 'include_vars' },
  { id: 'set_fact', label: 'set_fact task', docs: 'Registered vars and set_facts' },
  { id: 'role-params', label: 'role params (app_port: written next to role: in roles:)', docs: 'Role (and include_role) params' },
  { id: 'extra-vars', label: 'extra vars (-e on the command line)', docs: 'Extra vars' },
];

// One more place that the documentation does not list: vars: written under a role in roles:.
// render() accepts it, the ladder does not use it. It is checked separately.
export const ROLE_ENTRY_VARS = 'role-entry-vars';

// The six places the README teaches first. Names are the ids above.
export const CORE = ['role-defaults', 'playbook-group_vars-all', 'playbook-group_vars-web', 'playbook-host_vars-web2', 'play-vars', 'extra-vars'];

const yml = (id) => `---\napp_port: ${id}\n`;

function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/**
 * Write the project into `dir` with only the places in `on` (a Set of ids).
 * Returns { extra }: the extra arguments for ansible-playbook.
 */
export function render(dir, on) {
  rmSync(dir, { recursive: true, force: true });
  const has = (id) => on.has(id);

  // Inventory: web1 and web2, the login settings, and maybe a group var and a host var.
  const inv = ['[web]', 'web1', has('inventory-host-var') ? 'web2 app_port=inventory-host-var' : 'web2', ''];
  if (has('inventory-group-var')) inv.push('[web:vars]', 'app_port=inventory-group-var', '');
  inv.push('[all:vars]', 'ansible_user=ansible', 'ansible_ssh_private_key_file=/home/learner/.ssh/id_ed25519', '');
  write(join(dir, 'inv/inventory.ini'), inv.join('\n'));

  if (has('inventory-group_vars-all')) write(join(dir, 'inv/group_vars/all.yml'), yml('inventory-group_vars-all'));
  if (has('inventory-group_vars-web')) write(join(dir, 'inv/group_vars/web.yml'), yml('inventory-group_vars-web'));
  if (has('inventory-host_vars-web2')) write(join(dir, 'inv/host_vars/web2.yml'), yml('inventory-host_vars-web2'));
  if (has('playbook-group_vars-all')) write(join(dir, 'group_vars/all.yml'), yml('playbook-group_vars-all'));
  if (has('playbook-group_vars-web')) write(join(dir, 'group_vars/web.yml'), yml('playbook-group_vars-web'));
  if (has('playbook-host_vars-web2')) write(join(dir, 'host_vars/web2.yml'), yml('playbook-host_vars-web2'));

  // The role: defaults and vars are optional. Its task shows what the role itself sees.
  if (has('role-defaults')) write(join(dir, 'roles/appconf/defaults/main.yml'), yml('role-defaults'));
  if (has('role-vars')) write(join(dir, 'roles/appconf/vars/main.yml'), yml('role-vars'));
  write(
    join(dir, 'roles/appconf/tasks/main.yml'),
    ['---', '- name: Show what the role sees', '  ansible.builtin.debug:', '    msg: "ROLE app_port={{ app_port | default(\'(not set)\') }}"', ''].join('\n'),
  );
  if (has('play-vars_files')) write(join(dir, 'vars/extra.yml'), yml('play-vars_files'));
  if (has('include_vars')) write(join(dir, 'vars/included.yml'), yml('include_vars'));

  // The playbook. One probe task prints the value that wins.
  const p = ['---', '- name: Which app_port wins?', '  hosts: web', '  gather_facts: false'];
  if (has('play-vars')) p.push('  vars:', '    app_port: play-vars');
  if (has('play-vars_files')) p.push('  vars_files:', '    - vars/extra.yml');
  if (has('include_vars') || has('set_fact')) p.push('  pre_tasks:');
  if (has('include_vars')) p.push('    - name: Load a vars file', '      ansible.builtin.include_vars:', '        file: vars/included.yml', '');
  if (has('set_fact')) p.push('    - name: Set a fact', '      ansible.builtin.set_fact:', '        app_port: set_fact', '');
  p.push('  roles:');
  p.push('    - role: appconf');
  if (has('role-params')) p.push('      app_port: role-params');
  if (has('role-entry-vars')) p.push('      vars:', '        app_port: role-entry-vars');
  p.push('  tasks:');
  p.push('    - name: Probe', '      block:');
  p.push('        - name: Print the winner', '          ansible.builtin.debug:', '            msg: "PROBE app_port={{ app_port }}"');
  if (has('task-vars')) p.push('          vars:', '            app_port: task-vars');
  if (has('block-vars')) p.push('      vars:', '        app_port: block-vars');
  p.push('');
  write(join(dir, 'site.yml'), p.join('\n'));

  // The extra arguments for ansible-playbook: -e only when extra vars are switched on.
  return { extra: has('extra-vars') ? ['-e', 'app_port=extra-vars'] : [] };
}

/**
 * What the two probes printed, per host: { play: { web1, web2 }, role: { web1, web2 } }.
 * "play" is the task after the role, "role" is the task inside the role.
 */
export function winners(text) {
  const out = { play: {}, role: {} };
  for (const m of text.matchAll(/ok: \[(web\d)\] => \{\s*"msg": "(PROBE|ROLE) app_port=([^"]+)"/g)) out[m[2] === 'PROBE' ? 'play' : 'role'][m[1]] = m[3];
  return out;
}
