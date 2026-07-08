import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  PHASES, TRACK_SEQUENCES, StateError,
  parseFrontmatter, serializeFrontmatter, validateState,
  slugify, collides, nextPhase, newStateRecord,
  taskBoardLine, doneBoardLine, boardModel, lastGateOutcome, resolveContractPath,
  insertActiveLine,
} from '../scripts/lib/state.mjs';

const keyArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9-]{0,12}$/);
const valueArb = fc.string({ maxLength: 40 }).map((s) => s.replace(/[\n\r]/g, ' ').trim());
const bodyArb = fc.string({ maxLength: 200 }).map((s) => s.replace(/\r/g, ''));

describe('frontmatter round-trip (state record format)', () => {
  // @clause C11
  it('C11: parse(serialize(x)) === x for arbitrary flat records', () => {
    fc.assert(
      fc.property(fc.dictionary(keyArb, valueArb, { maxKeys: 8 }), bodyArb, (fields, body) => {
        const out = parseFrontmatter(serializeFrontmatter({ fields, body }), 'mem');
        expect(out.fields).toEqual(fields);
        expect(out.body).toBe(body);
      }),
    );
  });

  // @clause C11
  it('C11: corrupt records throw loudly, naming the file — never a partial result', () => {
    expect(() => parseFrontmatter('no delimiter', 'docs/features/x/workflow.md'))
      .toThrowError(/line 1/);
    try {
      parseFrontmatter('---\nslug broken line\n---\n', 'docs/features/x/workflow.md');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(StateError);
      expect(e.file).toBe('docs/features/x/workflow.md');
      expect(e.message).toContain('slug broken line');
    }
    expect(() => parseFrontmatter('---\na: 1\n', 'f')).toThrowError(/close delimiter/);
    expect(() => parseFrontmatter('---\na: 1\na: 2\n---\n', 'f')).toThrowError(/duplicate/);
  });

  // @clause C11
  it('C11: parser edge behavior is exact — anchors, spacing, trimming, blank lines', () => {
    expect(parseFrontmatter('---\nk:v\n---\n', 'f').fields.k).toBe('v');
    expect(parseFrontmatter('---\nk:  spaced  \n---\n', 'f').fields.k).toBe('spaced');
    expect(parseFrontmatter('---\n  \nk: v\n---\n', 'f').fields.k).toBe('v');
    expect(() => parseFrontmatter('---\n!bad: v\n---\n', 'f')).toThrowError(/unparseable/);
    expect(parseFrontmatter('---\n---\nbody', 'f')).toEqual({ fields: {}, body: 'body' });
  });
});

describe('slug normalization (intake collisions)', () => {
  // @clause C2
  it('C2: "Lunar Export" collides with existing "lunar-export"', () => {
    expect(collides('Lunar Export', ['lunar-export', 'other'])).toBe('lunar-export');
    expect(collides('brand-new', ['lunar-export'])).toBeNull();
  });

  // @clause C2
  it('C2: slugify goldens — separators collapse, edge dashes strip fully, diacritics fold', () => {
    expect(slugify('Lunar  Export!')).toBe('lunar-export');
    expect(slugify('--a--')).toBe('a');
    expect(slugify('__Crash on empty CSV__')).toBe('crash-on-empty-csv');
    expect(slugify('Éxport Café')).toBe('export-cafe');
  });

  // @clause C2
  it('C2: slugify is idempotent and kebab-canonical', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (s) => {
        const once = slugify(s);
        expect(slugify(once)).toBe(once);
        expect(once).toMatch(/^$|^[a-z0-9]+(-[a-z0-9]+)*$/);
      }),
    );
  });
});

describe('intake builders', () => {
  // @clause C1
  it('C1: feature intake starts at define with a dated record and one board line', () => {
    const { slug, text } = newStateRecord({ title: 'Lunar Export', track: 'feature', today: '2026-07-08' });
    const { fields } = parseFrontmatter(text, 'mem');
    expect(slug).toBe('lunar-export');
    expect(fields.phase).toBe('define');
    expect(fields.created).toBe('2026-07-08');
    validateState(fields, 'mem');
    const line = taskBoardLine({ title: 'Lunar Export', slug, phase: fields.phase });
    expect(line.match(/- \[ \]/g)).toHaveLength(1);
    expect(line).toContain('docs/features/lunar-export/');
  });

  // @clause C3
  it('C3: fix intake starts at contract with design pre-marked skipped', () => {
    const { text } = newStateRecord({ title: 'crash on empty csv', track: 'fix', today: '2026-07-08' });
    const { fields, body } = parseFrontmatter(text, 'mem');
    expect(fields.phase).toBe('contract');
    expect(body).toContain('design phase skipped at intake (fix track)');
  });

  // @clause C14
  it('C14: intake refuses non-ISO dates ("yesterday", slashes, embedded garbage)', () => {
    for (const bad of ['yesterday', '2026/07/08', '08-07-2026', '', undefined, 'x2026-07-08', '2026-07-08x', '2026-07-089']) {
      expect(() => newStateRecord({ title: 'x', track: 'feature', today: bad })).toThrowError(/ISO/);
    }
  });

  // @clause C1
  it('C1: intake builder edges — unknown track and empty slugs refuse; feature body has no skip note', () => {
    expect(() => newStateRecord({ title: 'x', track: 'hotfix', today: '2026-07-08' })).toThrowError(/unknown track/);
    expect(() => newStateRecord({ title: '!!!', track: 'feature', today: '2026-07-08' })).toThrowError(/empty slug/);
    const { text } = newStateRecord({ title: 'Clean Feature', track: 'feature', today: '2026-07-08' });
    expect(text).not.toContain('skipped at intake');
    expect(parseFrontmatter(text, 'mem').body).toContain('## Gate log');
  });

  // @clause C14
  it('C14: done board lines require an absolute ISO completion date', () => {
    expect(doneBoardLine({ title: 't', completedOn: '2026-07-08' })).toBe('- [x] ~~t~~ (2026-07-08)');
    expect(() => doneBoardLine({ title: 't', completedOn: 'today' })).toThrowError(/ISO/);
  });
});

describe('phase movement', () => {
  // @clause C5
  it('C5: the track sequences are exactly these, golden', () => {
    expect(TRACK_SEQUENCES.feature).toEqual(['define', 'contract', 'design', 'build', 'verify', 'ship', 'operate', 'done']);
    expect(TRACK_SEQUENCES.fix).toEqual(['contract', 'build', 'verify', 'ship', 'operate', 'done']);
    expect(PHASES).toEqual(['define', 'contract', 'design', 'build', 'verify', 'ship', 'operate', 'done']);
  });

  // @clause C5
  it('C5: advancing moves exactly one step in the track sequence, for every phase of every track', () => {
    for (const [track, seq] of Object.entries(TRACK_SEQUENCES)) {
      for (let i = 0; i < seq.length; i++) {
        const expected = i === seq.length - 1 ? null : seq[i + 1];
        expect(nextPhase(seq[i], track)).toBe(expected);
      }
    }
  });

  // @clause C5
  it('C5: the fix track has no design phase; the feature track never skips it', () => {
    expect(TRACK_SEQUENCES.fix).not.toContain('design');
    const f = TRACK_SEQUENCES.feature;
    expect(f[f.indexOf('contract') + 1]).toBe('design');
    expect(nextPhase('contract', 'feature')).toBe('design');
    expect(nextPhase('contract', 'fix')).toBe('build');
  });

  // @clause C5
  it('C5: every phase constant is covered by a track (census)', () => {
    const covered = new Set(Object.values(TRACK_SEQUENCES).flat());
    for (const p of PHASES) expect(covered.has(p), `phase ${p} unreachable`).toBe(true);
  });
});

describe('board model', () => {
  const rec = (slug, phase) => ({ fields: { slug, title: slug, track: 'feature', phase, created: '2026-07-08' }, lastGate: null });

  // @clause C15
  it('C15: done features are hidden by default and shown with includeDone', () => {
    const records = [rec('a', 'build'), rec('b', 'done')];
    expect(boardModel(records).map((r) => r.slug)).toEqual(['a']);
    expect(boardModel(records, { includeDone: true }).map((r) => r.slug)).toEqual(['a', 'b']);
  });

  // @clause C11
  it('C11: board rows carry slug, track, phase, and last gate outcome', () => {
    const rows = boardModel([{ fields: { slug: 's', title: 's', track: 'fix', phase: 'build', created: '2026-07-08' }, lastGate: '2026-07-08 · contract → build' }]);
    expect(rows[0]).toEqual({ slug: 's', track: 'fix', phase: 'build', lastGate: '2026-07-08 · contract → build' });
  });

  // @clause C11
  it('C11: lastGateOutcome returns the final checked transition, or null when none', () => {
    const body = ['- [x] 2026-07-01 · define → contract — ok', '- [ ] contract → design — pending', '- [x] 2026-07-08 · contract → design — signed'].join('\n');
    expect(lastGateOutcome(body)).toBe('2026-07-08 · contract → design — signed');
    expect(lastGateOutcome('no gates here')).toBeNull();
    expect(lastGateOutcome('note - [x] 2026-07-08 · not-a-marker-line')).toBeNull();
    expect(lastGateOutcome('- [x] 2026-07-08 no separator')).toBeNull();
    expect(lastGateOutcome('  - [x] 2026-07-08 · indented counts')).toBe('2026-07-08 · indented counts');
  });
});

describe('task board insertion', () => {
  // @clause C1
  it('C1: intake adds exactly one Active entry and preserves everything else', () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z ]{0,20}$/), { maxLength: 6 }), (extraLines) => {
        const original = ['# Tasks', '', '## Active', ...extraLines, '', '## Done', ''].join('\n');
        const line = taskBoardLine({ title: 'New Thing', slug: 'new-thing', phase: 'define' });
        const updated = insertActiveLine(original, line);
        expect(updated.split('- [ ] **New Thing**').length - 1).toBe(1);
        for (const l of extraLines) expect(updated).toContain(l);
        expect(() => insertActiveLine(updated, line)).toThrowError(/exactly one/);
      }),
    );
  });

  // @clause C1
  it('C1: a missing or Active-less board fails loudly or is created from the template', () => {
    const line = '- [ ] **X** - workflow feature, phase: define';
    expect(insertActiveLine(null, line)).toContain('## Active\n\n- [ ] **X**');
    expect(insertActiveLine('   ', line)).toContain('## Active\n\n- [ ] **X**');
    expect(() => insertActiveLine('# Tasks\nno sections', line)).toThrowError(/## Active/);
    expect(() => insertActiveLine('mentions ## Active inline only', line)).toThrowError(/## Active/);
    expect(() => insertActiveLine('## Active Extra\ncontent', line)).toThrowError(/## Active/);
  });

  // @clause C1
  it('C1: the entry lands inside the Active section — after its heading, before the next section', () => {
    const line = '- [ ] **X** - workflow feature, phase: define';
    const updated = insertActiveLine('# Tasks\n\n##   Active\n\n## Done\n', line);
    expect(updated.indexOf(line)).toBeGreaterThan(updated.indexOf('Active'));
    expect(updated.indexOf(line)).toBeLessThan(updated.indexOf('## Done'));
  });
});

describe('contract location', () => {
  // @clause C19
  it('C19: the feature-dir contract wins; root is the single-feature fallback; neither → null', () => {
    expect(resolveContractPath({ featureDir: 'docs/features/a', featureHasContract: true, rootHasContract: true })).toBe('docs/features/a/CONTRACT.md');
    expect(resolveContractPath({ featureDir: 'docs/features/a', featureHasContract: false, rootHasContract: true })).toBe('CONTRACT.md');
    expect(resolveContractPath({ featureDir: 'docs/features/a', featureHasContract: false, rootHasContract: false })).toBeNull();
  });
});

describe('state validation', () => {
  // @clause C11
  it('C11: every missing required field is named — slug, title, track, phase, created', () => {
    const base = { slug: 'ok', title: 't', track: 'feature', phase: 'define', created: '2026-07-08' };
    for (const required of ['slug', 'title', 'track', 'phase', 'created']) {
      const fields = { ...base };
      delete fields[required];
      try {
        validateState(fields, 'f');
        expect.unreachable(`should reject missing ${required}`);
      } catch (e) {
        expect(e.field).toBe(required);
        expect(e.message).toContain(required);
      }
    }
  });

  // @clause C11
  it('C11: validateState names the offending field in every rejection', () => {
    const base = { slug: 'ok', title: 't', track: 'feature', phase: 'define', created: '2026-07-08' };
    const cases = [
      [{ ...base, slug: 'Not Canonical' }, 'slug'],
      [{ ...base, track: 'hotfix' }, 'track'],
      [{ ...base, phase: 'testing' }, 'phase'],
      [{ ...base, phase: 'design', track: 'fix' }, 'phase'],
      [{ ...base, created: 'last week' }, 'created'],
    ];
    for (const [fields, field] of cases) {
      try {
        validateState(fields, 'f');
        expect.unreachable(`should reject ${field}`);
      } catch (e) {
        expect(e.field).toBe(field);
      }
    }
    expect(validateState(base, 'f')).toBe(base);
  });
});
