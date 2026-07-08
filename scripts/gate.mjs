#!/usr/bin/env node
// Gate CLI: read-only (C12) — gathers the inputs snapshot from disk, delegates
// every decision to lib/gate.mjs, prints a punch list on red (C4), exits 0/1.
// It never writes; only /next records transitions.
// Usage: node gate.mjs <slug> [target-repo-dir]

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { parseFrontmatter, validateState, resolveContractPath } from './lib/state.mjs';
import { gateChecks, gateResult, readThreshold, refusalForMissingState } from './lib/gate.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const slug = args[0];
const root = args[1] ?? '.';

if (!slug) {
  console.error('usage: node gate.mjs <slug> [target-repo-dir]');
  process.exit(1);
}

const featureDir = join(root, 'docs', 'features', slug);
const statePath = join(featureDir, 'workflow.md');
if (!existsSync(statePath)) {
  console.error(refusalForMissingState(slug));
  process.exit(1);
}

let fields, body;
try {
  ({ fields, body } = parseFrontmatter(readFileSync(statePath, 'utf8'), statePath));
  validateState(fields, statePath);
} catch (e) {
  console.error(`GATE FAILED: ${e.file ?? statePath}: ${e.message}`);
  process.exit(1);
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

const contractPath = resolveContractPath({
  featureDir,
  featureHasContract: existsSync(join(featureDir, 'CONTRACT.md')),
  rootHasContract: existsSync(join(root, 'CONTRACT.md')),
});

const mutationReportPath = join(root, 'reports', 'mutation', 'mutation.json');
const settingsText = read(join(root, '.claude', 'oracle-dev-workflow.local.md'));

// "Changed for the feature" (C21) = working-tree edits + untracked files +
// files touched by commits since the feature's intake date — micro-commits
// during build must not shrink the list to a vacuous green. Each listing
// fails independently and quietly (e.g. no HEAD before the first commit,
// where every file is untracked and ls-files still reports it).
const gitList = (cmd) => {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\n');
  } catch {
    return [];
  }
};
const changedModules = [...new Set([
  ...gitList('git diff --name-only HEAD'),
  ...gitList('git ls-files --others --exclude-standard'),
  ...gitList(`git log --since="${fields.created} 00:00" --name-only --pretty=format: --diff-filter=ACMR`),
])].filter((f) => /\.(mjs|cjs|js|ts|jsx|tsx)$/.test(f) && !/\.(test|spec)\./.test(f) && !/(^|\/)node_modules\//.test(f) && /(^|\/)(src|scripts\/lib)\//.test(f));

let testFiles = [];
const testDir = join(root, 'test');
if (existsSync(testDir)) {
  testFiles = readdirSync(testDir, { recursive: true }).map(String);
}

let testsPass = null;
if (fields.phase === 'build') {
  try {
    execSync('npm test', { cwd: root, stdio: 'pipe' });
    testsPass = true;
  } catch {
    testsPass = false;
  }
}

const inputs = {
  track: fields.track,
  stateBody: body,
  specPath: join(featureDir, 'spec.md'),
  specText: read(join(featureDir, 'spec.md')),
  contractPath,
  contractText: contractPath ? read(contractPath === 'CONTRACT.md' ? join(root, 'CONTRACT.md') : contractPath) : null,
  adrFiles: existsSync(featureDir) ? readdirSync(featureDir).filter((f) => /^adr-.*\.md$/.test(f)) : [],
  changedModules,
  testFiles,
  testsPass,
  mutationReportPath,
  mutationReportText: read(mutationReportPath),
  threshold: readThreshold(settingsText),
};

const result = gateResult(gateChecks(fields.phase, inputs));

console.log(`gate · ${slug} · phase: ${fields.phase} · ${result.green ? 'GREEN' : 'RED'}`);
for (const c of result.checks) {
  console.log(`  [${c.pass ? 'x' : ' '}] ${c.check} — ${c.artifact} — observed: ${c.observed}`);
}
if (!result.green) {
  console.log('\npunch list:');
  for (const f of result.failures) {
    console.log(`  - ${f.artifact}: ${f.check} (observed: ${f.observed})`);
  }
}
process.exit(result.green ? 0 : 1);
