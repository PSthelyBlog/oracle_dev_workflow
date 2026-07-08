#!/usr/bin/env node
// Board CLI: read-only (C12). Lists every tracked feature; any unparseable
// state record fails the whole board loudly, naming the file (C11).
// Usage: node board.mjs [target-repo-dir] [--json] [--all]

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, validateState, boardModel, lastGateOutcome } from './lib/state.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const root = args.find((a) => !a.startsWith('--')) ?? '.';
const featuresDir = join(root, 'docs', 'features');

if (!existsSync(featuresDir)) {
  console.log('no features tracked yet (docs/features/ does not exist) — start one with /oracle-dev-workflow:feature');
  process.exit(0);
}

const records = [];
for (const entry of readdirSync(featuresDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const statePath = join(featuresDir, entry.name, 'workflow.md');
  if (!existsSync(statePath)) {
    console.error(`BOARD FAILED: ${statePath} is missing — feature directory "${entry.name}" has no state record.`);
    console.error(`Adopt it with: /oracle-dev-workflow:feature ${entry.name}`);
    process.exit(1);
  }
  try {
    const { fields, body } = parseFrontmatter(readFileSync(statePath, 'utf8'), statePath);
    validateState(fields, statePath);
    records.push({ fields, lastGate: lastGateOutcome(body) });
  } catch (e) {
    console.error(`BOARD FAILED: ${e.file ?? statePath}: ${e.message}`);
    console.error('The board never renders a partial or wrong table — fix the record above and rerun.');
    process.exit(1);
  }
}

const rows = boardModel(records, { includeDone: flags.has('--all') });

if (flags.has('--json')) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

if (rows.length === 0) {
  console.log('no active features' + (flags.has('--all') ? '' : ' (done features hidden; use --all)'));
  process.exit(0);
}

const widths = { slug: 4, track: 5, phase: 5 };
for (const r of rows) {
  widths.slug = Math.max(widths.slug, r.slug.length);
  widths.track = Math.max(widths.track, r.track.length);
  widths.phase = Math.max(widths.phase, r.phase.length);
}
console.log(`${'slug'.padEnd(widths.slug)}  ${'track'.padEnd(widths.track)}  ${'phase'.padEnd(widths.phase)}  last gate`);
for (const r of rows) {
  console.log(`${r.slug.padEnd(widths.slug)}  ${r.track.padEnd(widths.track)}  ${r.phase.padEnd(widths.phase)}  ${r.lastGate ?? '—'}`);
}
