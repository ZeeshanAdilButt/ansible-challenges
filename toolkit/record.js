// Recorder: prints each step as it happens and can write results.md.
// A step has a command, the output and a one-line note.

import { writeFileSync } from 'node:fs';
import { arch, platform, release } from 'node:os';

export class Recorder {
  constructor(title) {
    this.title = title;
    this.steps = [];
  }

  /** Add a step and print it. Output is trimmed. */
  step(command, output, note) {
    const clean = String(output).replace(/\r\n/g, '\n').trimEnd();
    this.steps.push({ command, output: clean, note });
    console.log(`\n$ ${command}`);
    if (clean) console.log(clean);
    console.log(`-> ${note}`);
  }

  /** machine: one line such as "Windows 11, Docker Desktop, Engine 29.9.2, Node 22.22.2". */
  markdown(machine) {
    const head = machine || `${platform()} ${release()} ${arch()}, Node ${process.versions.node}`;
    const date = new Date().toISOString().slice(0, 10);
    const parts = [`# Results: ${this.title}`, '', `Recorded run. Machine: ${head}. Date: ${date}.`, ''];
    this.steps.forEach((s, i) => {
      parts.push(`## Step ${i + 1}`, '', '**Command**', '', '```sh', s.command, '```', '', '**Output**', '', '```text', s.output || '(no output)', '```', '', `**Note:** ${s.note}`, '');
    });
    return parts.join('\n');
  }

  write(path, machine) {
    writeFileSync(path, this.markdown(machine));
  }
}

/**
 * Shorten long ansible output for results.md. It changes the layout only, never a result:
 *  - a "stdout_lines" or "stderr_lines" list repeats the text of "stdout" or "stderr", so it becomes one line saying how many lines it has;
 *  - a line longer than maxLine characters is cut, and the line says how many characters were left out.
 * Count things (changed, failed, warnings) on the raw output, then record compactOutput(raw).
 */
export function compactOutput(text, { maxLine = 400 } = {}) {
  const out = [];
  const lines = String(text).split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)"(\w+)_lines": \[$/);
    if (m) {
      let j = i + 1;
      while (j < lines.length && !/^\s*\],?$/.test(lines[j])) j++;
      const comma = /,$/.test(lines[j] ?? '') ? ',' : '';
      out.push(`${m[1]}"${m[2]}_lines": [ ${j - i - 1} lines, the same text as "${m[2]}", left out ]${comma}`);
      i = j;
      continue;
    }
    const line = lines[i];
    out.push(line.length > maxLine ? `${line.slice(0, maxLine)} ... [${line.length - maxLine} more characters left out]` : line);
  }
  return out.join('\n');
}
