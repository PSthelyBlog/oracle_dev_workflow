import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  DEFAULT_THRESHOLD, parseStrykerScore, scoreMeetsThreshold, readThreshold,
  judgmentRecorded, specSections, unpairedModules, gateChecks, gateResult,
  shipAllowed, refusalForMissingState,
} from '../scripts/lib/gate.mjs';
import { specSkeleton } from '../scripts/lib/state.mjs';

describe('mutation score (verify gate)', () => {
  // @clause C6
  it('C6: threshold 80 with score 79.6 is red — raw value, no rounding', () => {
    expect(scoreMeetsThreshold(79.6, 80)).toBe(false);
    expect(scoreMeetsThreshold(79.999, 80)).toBe(false);
    expect(scoreMeetsThreshold(80, 80)).toBe(true);
    expect(scoreMeetsThreshold(80.0001, 80)).toBe(true);
  });

  // @clause C6
  it('C6: metamorphic — raising a passing score never turns the gate red', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 5, noNaN: true }),
        (score, threshold, bump) => {
          if (scoreMeetsThreshold(score, threshold)) {
            expect(scoreMeetsThreshold(score + bump, threshold)).toBe(true);
          }
        },
      ),
    );
  });

  // @clause C7
  it('C7: absent or unreadable reports throw — never a vacuous pass', () => {
    expect(() => parseStrykerScore(null)).toThrowError(/absent/);
    expect(() => parseStrykerScore(undefined)).toThrowError(/absent/);
    expect(() => parseStrykerScore('{not json')).toThrowError(/unreadable/);
    expect(() => parseStrykerScore('{"hello": 1}')).toThrowError(/no numeric mutation score/);
  });

  // @clause C7
  it('C7: reads mutationScore directly, or derives it from the mutant census', () => {
    expect(parseStrykerScore('{"mutationScore": 83.4}')).toBe(83.4);
    const report = {
      files: {
        'a.mjs': { mutants: [{ status: 'Killed' }, { status: 'Killed' }, { status: 'Timeout' }, { status: 'Survived' }] },
        'b.mjs': { mutants: [{ status: 'Ignored' }] },
      },
    };
    expect(parseStrykerScore(JSON.stringify(report))).toBe(75);
  });

  // @clause C7
  it('C7: census counts every status correctly — errors excluded, Ignored skipped, Timeout kills', () => {
    const report = {
      files: {
        'a.mjs': {
          mutants: [
            { status: 'Killed' }, { status: 'Survived' }, { status: 'Timeout' },
            { status: 'RuntimeError' }, { status: 'CompileError' },
            { status: 'NoCoverage' }, { status: 'Ignored' },
          ],
        },
      },
    };
    expect(parseStrykerScore(JSON.stringify(report))).toBe(50);
    expect(parseStrykerScore('{"thresholds": {"break": 80}, "score": 72}')).toBe(72);
    expect(() => parseStrykerScore('{"files": {"a.mjs": {"mutants": []}}}')).toThrowError(/no numeric/);
  });

  // @clause C6
  it('C6: threshold defaults to 80 and reads the settings override', () => {
    expect(readThreshold(null)).toBe(DEFAULT_THRESHOLD);
    expect(DEFAULT_THRESHOLD).toBe(80);
    expect(readThreshold('---\nmutation-threshold: 85\n---')).toBe(85);
    expect(readThreshold('mutation-threshold: 72.5')).toBe(72.5);
    expect(readThreshold('mutation-threshold: 72.55')).toBe(72.55);
    expect(readThreshold('mutation-threshold:90')).toBe(90);
    expect(readThreshold('nothing relevant')).toBe(80);
  });

  // @clause C6
  it('C6: the settings key must be a whole line — prefixed or suffixed lines are not the setting', () => {
    expect(readThreshold('pre-mutation-threshold: 9')).toBe(80);
    expect(readThreshold('mutation-threshold: 85 percent')).toBe(80);
  });
});

describe('gate composition', () => {
  // @clause C20
  it('C20: a gate is red when any single check fails — never partial success', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 1, maxLength: 12 }), (passes) => {
        const checks = passes.map((pass, i) => ({ check: `c${i}`, artifact: 'a', pass, observed: 'o' }));
        const result = gateResult(checks);
        expect(result.green).toBe(passes.every(Boolean));
        expect(result.failures).toHaveLength(passes.filter((p) => !p).length);
      }),
    );
  });

  // @clause C20
  it('C20: every lifecycle phase has an enumerated gate', () => {
    const inputs = { track: 'feature', stateBody: '', adrFiles: [], changedModules: [], testFiles: [] };
    for (const phase of ['define', 'contract', 'design', 'build', 'verify', 'ship', 'operate']) {
      expect(gateChecks(phase, inputs).length, `phase ${phase}`).toBeGreaterThan(0);
    }
    expect(() => gateChecks('nonsense', inputs)).toThrowError(/no gate defined/);
  });

  // @clause C4
  it('C4: every failed check names the artifact, the check, and the observed value', () => {
    const result = gateResult(gateChecks('define', { specPath: 'docs/features/x/spec.md', specText: null }));
    expect(result.green).toBe(false);
    for (const f of result.failures) {
      expect(f.artifact).toBeTruthy();
      expect(f.check).toBeTruthy();
      expect(String(f.observed)).toBeTruthy();
    }
    expect(result.failures[0].observed).toBe('missing');
  });
});

describe('phase gates', () => {
  // @clause C9
  it('C9: contract gate is red until signed with zero OPEN ledger items', () => {
    const path = 'CONTRACT.md';
    const red1 = gateResult(gateChecks('contract', { contractPath: path, contractText: 'status: draft\nC1. (MUST) x' }));
    expect(red1.green).toBe(false);
    const red2 = gateResult(gateChecks('contract', { contractPath: path, contractText: 'status: signed\nA1. [OPEN] undecided thing' }));
    expect(red2.green).toBe(false);
    expect(red2.failures[0].observed).toBe('1 OPEN');
    const green = gateResult(gateChecks('contract', { contractPath: path, contractText: 'status: signed\nA1. [RESOLVED → C2] decided' }));
    expect(green.green).toBe(true);
  });

  // @clause C3
  it('C3: design gate is green on the fix track via the intake-time skip', () => {
    const fix = gateResult(gateChecks('design', { track: 'fix' }));
    expect(fix.green).toBe(true);
    expect(fix.checks[0].observed).toContain('skipped at intake');
    const feature = gateResult(gateChecks('design', { track: 'feature', adrFiles: [] }));
    expect(feature.green).toBe(false);
  });

  // @clause C21
  it('C21: build gate checks pairing for changed modules only — untouched repo debt does not block', () => {
    const tests = ['state.oracle.test.mjs', 'gate.oracle.test.mjs'];
    const green = gateResult(gateChecks('build', {
      testsPass: true,
      changedModules: ['scripts/lib/state.mjs', 'scripts/lib/gate.mjs'],
      testFiles: tests,
    }));
    expect(green.green).toBe(true);
    const red = gateResult(gateChecks('build', {
      testsPass: true,
      changedModules: ['scripts/lib/legacy.mjs'],
      testFiles: tests,
    }));
    expect(red.green).toBe(false);
    expect(red.failures[0].observed).toContain('scripts/lib/legacy.mjs');
    expect(unpairedModules(['src/a.mjs'], ['a.test.mjs'])).toEqual([]);
    expect(unpairedModules(['src/a.mjs'], ['a-helpers.mjs'])).toEqual(['src/a.mjs']);
  });

  // @clause C7
  // @clause C8
  it('C7/C8: verify gate is red on missing report, and requires recorded audit + review', () => {
    const body = '- [x] 2026-07-08 · contract-audit: green\n- [x] 2026-07-08 · review: clean';
    const missing = gateResult(gateChecks('verify', { mutationReportPath: 'reports/mutation/mutation.json', mutationReportText: null, stateBody: body, threshold: 80 }));
    expect(missing.green).toBe(false);
    expect(missing.failures.some((f) => /absent/.test(String(f.observed)))).toBe(true);

    const green = gateResult(gateChecks('verify', { mutationReportPath: 'r.json', mutationReportText: '{"mutationScore": 80}', stateBody: body, threshold: 80 }));
    expect(green.green).toBe(true);

    const boundary = gateResult(gateChecks('verify', { mutationReportPath: 'r.json', mutationReportText: '{"mutationScore": 79.6}', stateBody: body, threshold: 80 }));
    expect(boundary.green).toBe(false);
    expect(boundary.failures[0].observed).toBe('79.6');

    const noAudit = gateResult(gateChecks('verify', { mutationReportPath: 'r.json', mutationReportText: '{"mutationScore": 95}', stateBody: '- [x] 2026-07-08 · review: clean', threshold: 80 }));
    expect(noAudit.green).toBe(false);
  });

  // @clause C8
  it('C8: judgment checks count only when recorded as checked gate-log lines', () => {
    expect(judgmentRecorded('- [x] 2026-07-08 · contract-audit: green', 'contract-audit')).toBe('green');
    expect(judgmentRecorded('- [x] 2026-07-08 · review:  clean  ', 'review')).toBe('clean');
    expect(judgmentRecorded('- [ ] contract-audit: green (pending)', 'contract-audit')).toBeNull();
    expect(judgmentRecorded('x - [x] contract-audit: green', 'contract-audit')).toBeNull();
    expect(judgmentRecorded('', 'contract-audit')).toBeNull();
  });

  // @clause C8
  it('C8: a later re-recording supersedes an earlier one — the log is append-only history', () => {
    const body = [
      '- [x] 2026-07-01 · contract-audit: red (C9 untagged)',
      '- [x] 2026-07-05 · contract-audit: green',
    ].join('\n');
    expect(judgmentRecorded(body, 'contract-audit')).toBe('green');
  });
});

describe('shipping', () => {
  // @clause C10
  it('C10: shipping from any earlier phase is refused even with a green gate', () => {
    for (const phase of ['define', 'contract', 'design', 'build', 'verify']) {
      const v = shipAllowed({ phase, gateGreen: true });
      expect(v.allowed).toBe(false);
      expect(v.reason).toContain('no fast-forward');
    }
  });

  // @clause C17
  it('C17: a red gate blocks shipping unconditionally — no waiver path exists', () => {
    const v = shipAllowed({ phase: 'ship', gateGreen: false });
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain('unconditionally');
    expect(shipAllowed({ phase: 'ship', gateGreen: true }).allowed).toBe(true);
  });
});

describe('unmanaged directories', () => {
  // @clause C18
  it('C18: refusal names the missing record, the expected path, and the adopting intake command', () => {
    const msg = refusalForMissingState('quick-hack');
    expect(msg).toContain('docs/features/quick-hack/workflow.md');
    expect(msg).toContain('missing');
    expect(msg).toContain('/oracle-dev-workflow:feature quick-hack');
    expect(msg).toContain('define');
  });
});

describe('spec sections (define gate)', () => {
  // @clause C20
  it('C20: define gate needs goals, non-goals, and acceptance criteria — with content, not bare headings', () => {
    const full = '## Goals\n1. real goal\n## Non-goals\n- not this\n### Must-have\nacceptance criteria listed';
    expect(specSections(full)).toEqual({ goals: true, nonGoals: true, acceptanceCriteria: true });
    const s = specSections('## Goals\nonly goals');
    expect(s.goals).toBe(true);
    expect(s.nonGoals).toBe(false);
    const checks = gateChecks('define', { specPath: 'spec.md', specText: full });
    expect(gateResult(checks).green).toBe(true);
  });

  // @clause C20
  it('C20: a bare heading is not a section — heading-only specs stay red', () => {
    expect(specSections('## Goals\n\n## Non-goals\n\ncontent below non-goals').goals).toBe(false);
    expect(specSections('## Goals\n### User goals\n## Non-goals').goals).toBe(true);
    expect(specSections('##   Goals\nsome content').goals).toBe(true);
    const inline = specSections('see ## goals reference and ## non-goals note');
    expect(inline.goals).toBe(false);
    expect(inline.nonGoals).toBe(false);
    expect(specSections('just acceptance criteria mentioned').acceptanceCriteria).toBe(true);
    expect(specSections('### Must-have only').acceptanceCriteria).toBe(true);
    expect(specSections('empty').acceptanceCriteria).toBe(false);
  });

  // @clause C20
  it('C20: the intake skeleton itself leaves the define gate red — intake can never green its own gate', () => {
    const skeleton = specSkeleton({ title: 'Fresh Idea', slug: 'fresh-idea', today: '2026-07-08' });
    const r = gateResult(gateChecks('define', { specPath: 'spec.md', specText: skeleton }));
    expect(r.green).toBe(false);
    expect(specSections(skeleton)).toEqual({ goals: false, nonGoals: false, acceptanceCriteria: false });
  });
});

describe('remaining gate branches', () => {
  // @clause C9
  it('C9: a missing contract fails the exists check with observed "missing"', () => {
    const r = gateResult(gateChecks('contract', { contractPath: null, contractText: null }));
    expect(r.green).toBe(false);
    expect(r.checks[0].observed).toBe('missing');
  });

  // @clause C21
  it('C21: build gate reports failing and unrun test suites distinctly, and multi-dot module names pair correctly', () => {
    const failing = gateResult(gateChecks('build', { testsPass: false, changedModules: [], testFiles: [] }));
    expect(failing.green).toBe(false);
    expect(failing.failures[0].observed).toBe('false');
    const unrun = gateResult(gateChecks('build', { testsPass: null, changedModules: [], testFiles: [] }));
    expect(unrun.green).toBe(false);
    expect(unrun.failures[0].observed).toBe('not run');
    expect(unpairedModules(['src/x.ts.mjs'], ['x.ts.test.mjs'])).toEqual([]);
  });

  // @clause C6
  it('C6: verify gate uses the default threshold when none is configured', () => {
    const body = '- [x] 2026-07-08 · contract-audit: green\n- [x] 2026-07-08 · review: clean';
    const green = gateResult(gateChecks('verify', { mutationReportPath: 'r.json', mutationReportText: '{"mutationScore": 85}', stateBody: body }));
    expect(green.green).toBe(true);
    const red = gateResult(gateChecks('verify', { mutationReportPath: 'r.json', mutationReportText: '{"mutationScore": 79.9}', stateBody: body }));
    expect(red.green).toBe(false);
  });

  // @clause C20
  it('C20: ship and operate gates read their recorded keys', () => {
    const shipGreen = gateResult(gateChecks('ship', { stateBody: '- [x] 2026-07-08 · deploy-checklist: complete\n- [x] 2026-07-08 · merged: main@abc123' }));
    expect(shipGreen.green).toBe(true);
    const shipRed = gateResult(gateChecks('ship', { stateBody: '- [x] 2026-07-08 · deploy-checklist: complete' }));
    expect(shipRed.green).toBe(false);
    expect(gateResult(gateChecks('operate', { stateBody: '- [x] 2026-07-08 · learnings: postmortem clauses added' })).green).toBe(true);
    expect(gateResult(gateChecks('operate', { stateBody: '' })).green).toBe(false);
  });
});
