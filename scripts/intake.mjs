#!/usr/bin/env node
// Intake CLI: the only script that writes state. Creates a feature's state
// record and exactly one task-board entry (C1/C3), refuses slug collisions
// (C2), adopts unmanaged directories at define (C18).
// Usage: node intake.mjs <title words...> [--track feature|fix] [--root <dir>] [--today YYYY-MM-DD]

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  slugify, collides, newStateRecord, taskBoardLine, insertActiveLine,
  parseFrontmatter, serializeFrontmatter, specSkeleton,
} from './lib/state.mjs';

const argv = process.argv.slice(2);
const flagIndex = argv.findIndex((a) => a.startsWith('--'));
const title = (flagIndex === -1 ? argv : argv.slice(0, flagIndex)).join(' ').trim();
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const track = opt('track', 'feature');
const root = opt('root', '.');
const today = opt('today', new Date().toISOString().slice(0, 10));

if (!title) {
  console.error('usage: node intake.mjs <title words...> [--track feature|fix] [--root <dir>] [--today YYYY-MM-DD]');
  process.exit(1);
}

const featuresDir = join(root, 'docs', 'features');
const existing = existsSync(featuresDir)
  ? readdirSync(featuresDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];

const slug = slugify(title);
const dir = join(featuresDir, slug);
const statePath = join(dir, 'workflow.md');

const hit = collides(title, existing);
if (hit !== null && existsSync(join(featuresDir, hit, 'workflow.md'))) {
  console.error(`REFUSED: "${title}" collides with existing feature "${hit}" (docs/features/${hit}/) — existing state is never overwritten.`);
  process.exit(1);
}

// Adoption (C18): directory exists but was never taken through intake.
// Adopted directories always backfill at define, so the track is feature.
const adopting = existsSync(dir) && !existsSync(statePath);
const effectiveTrack = adopting ? 'feature' : track;
const phase = effectiveTrack === 'fix' ? 'contract' : 'define';

const record = newStateRecord({ title, track: effectiveTrack, today });
if (adopting) {
  const { fields, body } = parseFrontmatter(record.text, statePath);
  record.text = serializeFrontmatter({
    fields,
    body: body.replace('## Gate log', `## Gate log\n\n- ${today} · adopted existing directory; state backfilled at define`),
  });
}

mkdirSync(dir, { recursive: true });
writeFileSync(statePath, record.text);

const specPath = join(dir, 'spec.md');
if (effectiveTrack === 'feature' && !existsSync(specPath)) {
  writeFileSync(specPath, specSkeleton({ title, slug, today }));
}

const tasksPath = join(root, 'TASKS.md');
const tasksText = existsSync(tasksPath) ? readFileSync(tasksPath, 'utf8') : null;
writeFileSync(tasksPath, insertActiveLine(tasksText, taskBoardLine({ title, slug, phase })));

console.log(`${adopting ? 'adopted' : 'created'}: docs/features/${slug}/ (track: ${effectiveTrack}, phase: ${phase})`);
console.log(`state:   docs/features/${slug}/workflow.md`);
if (effectiveTrack === 'feature') console.log(`spec:    docs/features/${slug}/spec.md`);
console.log('board:   TASKS.md updated (one new Active entry)');
