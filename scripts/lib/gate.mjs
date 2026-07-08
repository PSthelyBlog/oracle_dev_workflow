// Gate engine for oracle-dev-workflow. Pure predicates over an `inputs`
// snapshot gathered by the CLI edge — nothing here reads or writes disk (C12).
// Every check returns {check, artifact, pass, observed} so red gates print an
// actionable punch list (C4). A gate is green only when every check passes (C20).

import { StateError } from './state.mjs';

export const DEFAULT_THRESHOLD = 80;

// --- mutation report (C6, C7) ---

export function parseStrykerScore(jsonText) {
  if (jsonText === null || jsonText === undefined) {
    throw new StateError('mutation report is absent — run the mutation suite (oracle-audit) first');
  }
  let report;
  try {
    report = JSON.parse(jsonText);
  } catch {
    throw new StateError('mutation report is unreadable (invalid JSON)');
  }
  const score = extractScore(report);
  if (typeof score !== 'number' || Number.isNaN(score)) {
    throw new StateError('mutation report has no numeric mutation score');
  }
  return score;
}

function extractScore(report) {
  if (typeof report.mutationScore === 'number') return report.mutationScore;
  if (report.thresholds && typeof report.score === 'number') return report.score;
  if (report.files && typeof report.files === 'object') {
    let killed = 0;
    let total = 0;
    for (const file of Object.values(report.files)) {
      for (const m of file.mutants ?? []) {
        if (m.status === 'Ignored') continue;
        total += 1;
        if (m.status === 'Killed' || m.status === 'Timeout') killed += 1;
        if (m.status === 'RuntimeError' || m.status === 'CompileError') total -= 1;
      }
    }
    if (total > 0) return (killed / total) * 100;
  }
  return NaN;
}

// Raw comparison, no rounding: 79.6 at threshold 80 is red (C6).
export function scoreMeetsThreshold(score, threshold) {
  return score >= threshold;
}

export function readThreshold(settingsText) {
  if (!settingsText) return DEFAULT_THRESHOLD;
  const m = settingsText.match(/^mutation-threshold:\s*([0-9]+(?:\.[0-9]+)?)\s*$/m);
  if (!m) return DEFAULT_THRESHOLD;
  return Number(m[1]);
}

// --- judgment checks recorded in the gate log body ---

// The gate log is append-only history: a later re-recording supersedes an
// earlier one, so the LAST matching line wins (mirrors lastGateOutcome).
export function judgmentRecorded(body, key) {
  const re = new RegExp(`^- \\[x\\] .*${escapeRegExp(key)}\\s*[:·]\\s*(.+)$`, 'gm');
  const matches = [...String(body ?? '').matchAll(re)];
  return matches.length ? matches[matches.length - 1][1].trim() : null;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- spec sections (define gate) ---

// A heading alone is not a section: intake's skeleton must never green the
// define gate. A section counts only when its heading is followed by real
// content (any non-heading text, or a deeper subheading) before a heading of
// the same or higher level.
export function sectionHasContent(specText, title) {
  const lines = String(specText ?? '').split('\n');
  const headingRe = new RegExp(`^(#{1,3})\\s+${title}\\s*$`, 'i');
  const start = lines.findIndex((l) => headingRe.test(l.trim()));
  if (start === -1) return false;
  const level = lines[start].trim().match(/^#+/)[0].length;
  for (let i = start + 1; i < lines.length; i++) {
    const h = lines[i].match(/^(#{1,6})\s/);
    if (h && h[1].length <= level) return false;
    if (h) return true;
    if (lines[i].trim() !== '') return true;
  }
  return false;
}

export function specSections(specText) {
  const text = String(specText ?? '').toLowerCase();
  return {
    goals: sectionHasContent(specText, 'goals'),
    nonGoals: sectionHasContent(specText, 'non-goals'),
    acceptanceCriteria: /acceptance criteria/.test(text) || /must-have/.test(text),
  };
}

// --- paired oracles (build gate, C21: changed modules only) ---

export function unpairedModules(changedModules, testFiles) {
  const tests = testFiles.map((t) => t.toLowerCase());
  return changedModules.filter((mod) => {
    const base = mod.split('/').pop().replace(/\.(mjs|cjs|js|ts|jsx|tsx)$/, '').toLowerCase();
    return !tests.some((t) => t.includes(base) && /\.(test|spec)\./.test(t));
  });
}

// --- the gates (C20: any failing check → red) ---

// Stryker disable StringLiteral: check labels, artifact names, and observed
// wording are presentation — contractual slack per clause C16. The decisions
// (pass booleans, regexes, comparisons) remain fully mutated.
export function gateChecks(phase, inputs) {
  switch (phase) {
    case 'define': {
      const sections = specSections(inputs.specText);
      return [
        check('spec file exists', inputs.specPath, inputs.specText != null, inputs.specText != null ? 'present' : 'missing'),
        check('spec has goals section', inputs.specPath, sections.goals, sections.goals ? 'present' : 'missing'),
        check('spec has non-goals section', inputs.specPath, sections.nonGoals, sections.nonGoals ? 'present' : 'missing'),
        check('spec has acceptance criteria', inputs.specPath, sections.acceptanceCriteria, sections.acceptanceCriteria ? 'present' : 'missing'),
      ];
    }
    case 'contract': {
      const text = String(inputs.contractText ?? '');
      const exists = inputs.contractText != null;
      const signed = /^status:\s*signed\s*$/m.test(text);
      const openItems = (text.match(/^A\d+\.\s*\[OPEN\]/gm) ?? []).length;
      return [
        check('contract exists', inputs.contractPath, exists, exists ? 'present' : 'missing'),
        check('contract is signed', inputs.contractPath, signed, signed ? 'status: signed' : 'status: draft or missing'),
        check('ambiguity ledger has zero OPEN items', inputs.contractPath, openItems === 0, `${openItems} OPEN`),
      ];
    }
    case 'design': {
      if (inputs.track === 'fix') {
        return [check('design phase', 'workflow.md', true, 'skipped at intake (fix track)')];
      }
      const hasAdr = (inputs.adrFiles ?? []).length > 0;
      return [check('ADR present', 'docs/features/<slug>/adr-*.md', hasAdr, hasAdr ? inputs.adrFiles.join(', ') : 'none found')];
    }
    case 'build': {
      const unpaired = unpairedModules(inputs.changedModules ?? [], inputs.testFiles ?? []);
      return [
        check('test suite green', 'npm test', inputs.testsPass === true, inputs.testsPass === true ? 'pass' : String(inputs.testsPass ?? 'not run')),
        check('changed modules have paired oracles', 'scripts/lib', unpaired.length === 0, unpaired.length === 0 ? 'all paired' : `unpaired: ${unpaired.join(', ')}`),
      ];
    }
    case 'verify': {
      const checks = [];
      let score = null;
      try {
        score = parseStrykerScore(inputs.mutationReportText);
        const threshold = inputs.threshold ?? DEFAULT_THRESHOLD;
        checks.push(check('mutation report present and readable', inputs.mutationReportPath, true, 'readable'));
        checks.push(check(`mutation score >= ${threshold} (raw, no rounding)`, inputs.mutationReportPath, scoreMeetsThreshold(score, threshold), String(score)));
      } catch (e) {
        checks.push(check('mutation report present and readable', inputs.mutationReportPath, false, e.message));
        checks.push(check('mutation score >= threshold (raw, no rounding)', inputs.mutationReportPath, false, 'no score (report missing/unreadable)'));
      }
      const audit = judgmentRecorded(inputs.stateBody, 'contract-audit');
      const review = judgmentRecorded(inputs.stateBody, 'review');
      checks.push(check('clause-to-oracle traceability audit recorded green', 'workflow.md gate log', audit !== null && /green|pass/i.test(audit), audit ?? 'not recorded'));
      checks.push(check('code review recorded clean', 'workflow.md gate log', review !== null, review ?? 'not recorded'));
      return checks;
    }
    case 'ship': {
      const checklist = judgmentRecorded(inputs.stateBody, 'deploy-checklist');
      const merged = judgmentRecorded(inputs.stateBody, 'merged');
      return [
        check('deploy checklist recorded complete', 'workflow.md gate log', checklist !== null, checklist ?? 'not recorded'),
        check('merge recorded', 'workflow.md gate log', merged !== null, merged ?? 'not recorded'),
      ];
    }
    case 'operate': {
      const learnings = judgmentRecorded(inputs.stateBody, 'learnings');
      return [check('learnings recorded', 'workflow.md gate log', learnings !== null, learnings ?? 'not recorded')];
    }
    default:
      throw new StateError(`no gate defined for phase "${phase}"`);
  }
}

function check(name, artifact, pass, observed) {
  return { check: name, artifact, pass: pass === true, observed };
}
// Stryker restore StringLiteral

export function gateResult(checks) {
  return {
    green: checks.every((c) => c.pass),
    failures: checks.filter((c) => !c.pass),
    checks,
  };
}

// --- shipping (C10: no fast-forward; C17: red blocks unconditionally) ---

export function shipAllowed({ phase, gateGreen }) {
  if (phase !== 'ship') {
    // Stryker disable next-line StringLiteral: wording is slack (C16); the load-bearing "no fast-forward" fragment is oracle-pinned
    return { allowed: false, reason: `phase is "${phase}" — shipping requires the ship phase; there is no fast-forward` };
  }
  if (gateGreen !== true) {
    // Stryker disable next-line StringLiteral: wording is slack (C16); the load-bearing "unconditionally" fragment is oracle-pinned
    return { allowed: false, reason: 'gate is red — a red gate blocks shipping unconditionally (no waivers in v1)' };
  }
  // Stryker disable next-line StringLiteral: wording is slack (C16)
  return { allowed: true, reason: 'ship phase with green gate' };
}

// --- advancing without state (C18) ---

export function refusalForMissingState(slug) {
  // Stryker disable ArrayDeclaration, StringLiteral: message wording is slack (C16); the named path, "missing", and the intake command are oracle-pinned (C18)
  return [
    `no state record found for "${slug}" (expected docs/features/${slug}/workflow.md)`,
    `missing: workflow.md with slug/title/track/phase/created frontmatter`,
    `run /oracle-dev-workflow:feature ${slug} to adopt this directory (state backfills at the define phase)`,
  ].join('\n');
}
