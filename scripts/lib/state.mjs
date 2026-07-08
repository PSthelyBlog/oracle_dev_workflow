// State engine for oracle-dev-workflow. Pure functions only — all I/O lives in
// the CLI edges (board.mjs, gate.mjs). Frontmatter is a deliberate flat subset:
// string values, no nesting (ADR-001).

export const PHASES = ['define', 'contract', 'design', 'build', 'verify', 'ship', 'operate', 'done'];

export const TRACK_SEQUENCES = {
  feature: ['define', 'contract', 'design', 'build', 'verify', 'ship', 'operate', 'done'],
  fix: ['contract', 'build', 'verify', 'ship', 'operate', 'done'],
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class StateError extends Error {
  constructor(message, { file, field } = {}) {
    super(message);
    this.name = 'StateError';
    this.file = file ?? null;
    this.field = field ?? null;
  }
}

// --- frontmatter (flat subset) ---

export function parseFrontmatter(text, file) {
  if (typeof text !== 'string') throw new StateError('state record is not text', { file });
  const lines = text.split('\n');
  if (lines[0] !== '---') throw new StateError('missing frontmatter open delimiter "---" on line 1', { file });
  const fields = {};
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '---') { close = i; break; }
    if (line.trim() === '') continue;
    const m = line.match(/^([A-Za-z][A-Za-z0-9-]*):\s*(.*)/);
    if (!m) throw new StateError(`unparseable frontmatter line ${i + 1}: "${line}"`, { file });
    const [, key, value] = m;
    if (key in fields) throw new StateError(`duplicate frontmatter key "${key}"`, { file, field: key });
    fields[key] = value.trim();
  }
  if (close === -1) throw new StateError('missing frontmatter close delimiter "---"', { file });
  return { fields, body: lines.slice(close + 1).join('\n') };
}

export function serializeFrontmatter({ fields, body }) {
  const rendered = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return ['---', ...rendered, '---', body ?? ''].join('\n');
}

export function validateState(fields, file) {
  for (const required of ['slug', 'title', 'track', 'phase', 'created']) {
    if (!fields[required]) throw new StateError(`missing required field "${required}"`, { file, field: required });
  }
  if (fields.slug !== slugify(fields.slug)) {
    throw new StateError(`slug "${fields.slug}" is not kebab-case canonical`, { file, field: 'slug' });
  }
  if (!(fields.track in TRACK_SEQUENCES)) {
    throw new StateError(`unknown track "${fields.track}" (expected feature|fix)`, { file, field: 'track' });
  }
  if (!PHASES.includes(fields.phase)) {
    throw new StateError(`unknown phase "${fields.phase}"`, { file, field: 'phase' });
  }
  if (!TRACK_SEQUENCES[fields.track].includes(fields.phase)) {
    throw new StateError(`phase "${fields.phase}" is not in the ${fields.track} track`, { file, field: 'phase' });
  }
  if (!ISO_DATE.test(fields.created)) {
    throw new StateError(`created "${fields.created}" is not an absolute ISO date (YYYY-MM-DD)`, { file, field: 'created' });
  }
  return fields;
}

// --- slugs (C2: kebab-case normalization decides collisions) ---

export function slugify(name) {
  return String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function collides(name, existingSlugs) {
  const slug = slugify(name);
  const hit = existingSlugs.find((s) => slugify(s) === slug);
  return hit === undefined ? null : hit;
}

// --- phase movement (C5: exactly one step, never skip within the track) ---

export function nextPhase(phase, track) {
  const seq = TRACK_SEQUENCES[track];
  if (!seq) throw new StateError(`unknown track "${track}"`, { field: 'track' });
  const i = seq.indexOf(phase);
  if (i === -1) throw new StateError(`phase "${phase}" is not in the ${track} track`, { field: 'phase' });
  if (i === seq.length - 1) return null;
  return seq[i + 1];
}

// --- intake builders (C1, C3: commands write files; these decide their content) ---

export function newStateRecord({ title, track, today }) {
  if (!ISO_DATE.test(today ?? '')) throw new StateError(`intake date "${today}" is not ISO (YYYY-MM-DD)`, { field: 'created' });
  if (!(track in TRACK_SEQUENCES)) throw new StateError(`unknown track "${track}"`, { field: 'track' });
  const slug = slugify(title);
  if (!slug) throw new StateError(`title "${title}" produces an empty slug`, { field: 'slug' });
  const phase = TRACK_SEQUENCES[track][0];
  const skipNote = track === 'fix'
    ? `\n- ${today} · design phase skipped at intake (fix track)`
    : '';
  const body = [
    '',
    `# Workflow state: ${slug}`,
    '',
    'Phase history and gate log. Frontmatter `phase` is the single source of truth.',
    '',
    '## Gate log',
    skipNote,
    '',
  ].join('\n');
  return {
    slug,
    text: serializeFrontmatter({
      fields: { slug, title, track, phase, created: today },
      body,
    }),
  };
}

// Spec skeleton written at intake. Deliberately contains none of the define
// gate's trigger phrases and no filled sections — an untouched skeleton must
// leave the define gate red (see gate.mjs specSections).
export function specSkeleton({ title, slug, today }) {
  return `---\nfeature: ${slug}\ntype: spec\nstatus: draft\ndate: ${today}\n---\n\n# Spec: ${title}\n\n## Problem statement\n\n## Goals\n\n## Non-goals\n\n## Requirements\n\n(P0/P1 list — state how each will be verified)\n\n## Open questions\n`;
}

export function taskBoardLine({ title, slug, phase }) {
  return `- [ ] **${title}** - workflow feature, phase: ${phase}\n  - state: docs/features/${slug}/`;
}

export function doneBoardLine({ title, completedOn }) {
  if (!ISO_DATE.test(completedOn ?? '')) {
    throw new StateError(`completion date "${completedOn}" is not ISO (YYYY-MM-DD)`, { field: 'completed' });
  }
  return `- [x] ~~${title}~~ (${completedOn})`;
}

// --- board model (C11: all-or-nothing; C15: done hidden by default) ---

export function boardModel(records, { includeDone = false } = {}) {
  const rows = records.map(({ fields, lastGate }) => ({
    slug: fields.slug,
    track: fields.track,
    phase: fields.phase,
    lastGate: lastGate ?? '—',
  }));
  return includeDone ? rows : rows.filter((r) => r.phase !== 'done');
}

// Last recorded gate transition in a state body: the final checked gate-log line.
export function lastGateOutcome(body) {
  const checked = String(body ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^- \[x\] \d{4}-\d{2}-\d{2} · /.test(l));
  if (checked.length === 0) return null;
  return checked[checked.length - 1].replace(/^- \[x\] /, '');
}

// Task board insertion (C1: exactly one new Active entry per intake).
export function insertActiveLine(tasksText, line) {
  if (tasksText == null || tasksText.trim() === '') {
    return `# Tasks\n\n## Active\n\n${line}\n\n## Waiting On\n\n## Someday\n\n## Done\n`;
  }
  if (tasksText.includes(line)) {
    throw new StateError('task board already contains this entry — intake adds exactly one', { field: 'tasks' });
  }
  const lines = tasksText.split('\n');
  const i = lines.findIndex((l) => /^##\s+Active\s*$/.test(l));
  if (i === -1) throw new StateError('TASKS.md has no "## Active" section', { field: 'tasks' });
  lines.splice(i + 1, 0, '', ...line.split('\n'));
  return lines.join('\n');
}

// Contract location (C19): the feature's own contract wins; root is the
// single-feature fallback.
export function resolveContractPath({ featureDir, featureHasContract, rootHasContract }) {
  if (featureHasContract) return `${featureDir}/CONTRACT.md`;
  if (rootHasContract) return 'CONTRACT.md';
  return null;
}
