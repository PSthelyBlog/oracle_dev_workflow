// Meta-oracles: these read the plugin's own files, so drift between the
// routing table, the commands, and the read-only promise fails loudly here.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const readText = (...p) => readFileSync(join(root, ...p), 'utf8');
const pluginMap = readText('skills/workflow/references/plugin-map.md');
const gatesRef = readText('skills/workflow/references/gates.md');
const commandFiles = readdirSync(join(root, 'commands')).filter((f) => f.endsWith('.md'));
const commandText = Object.fromEntries(commandFiles.map((f) => [f, readText('commands', f)]));
const allCommandText = Object.values(commandText).join('\n');
const skillText = readText('skills/workflow/SKILL.md');

const SEVEN = ['intent-contract', 'test-oracle', 'productivity', 'product-management', 'engineering', 'commit-commands', 'feature-dev'];
const skillRef = /(intent-contract|test-oracle|productivity|product-management|engineering|commit-commands|feature-dev):[a-z0-9_-]+/g;

describe('routing table (C13)', () => {
  // @clause C13
  it('C13: the routing table covers every phase and the always-on layer', () => {
    for (const section of ['always-on', 'define', 'contract', 'design', 'build', 'verify', 'ship', 'operate']) {
      expect(pluginMap).toMatch(new RegExp(`^## ${section}$`, 'm'));
    }
  });

  // @clause C13
  it('C13: every skill a command or the orchestrator names is pinned in the routing table', () => {
    const pinned = new Set(pluginMap.match(skillRef) ?? []);
    expect(pinned.size).toBeGreaterThanOrEqual(20);
    const used = new Set([...(allCommandText.match(skillRef) ?? []), ...(skillText.match(skillRef) ?? [])]);
    expect(used.size).toBeGreaterThan(0);
    for (const ref of used) {
      expect(pinned.has(ref), `${ref} is used but not pinned in plugin-map.md`).toBe(true);
    }
  });

  // @clause C13
  it('C13: every pinned skill belongs to one of the seven plugins, and key routes exist', () => {
    for (const ref of pluginMap.match(skillRef) ?? []) {
      expect(SEVEN.includes(ref.split(':')[0]), ref).toBe(true);
    }
    expect(commandText['feature.md']).toContain('product-management:write-spec');
    expect(commandText['fix.md']).toContain('intent-contract:contract-new');
    expect(commandText['fix.md']).toContain('test-oracle:oracle-new');
    expect(commandText['next.md']).toContain('plugin-map.md');
    expect(commandText['ship.md']).toContain('engineering:deploy-checklist');
    expect(commandText['ship.md']).toContain('commit-commands:commit-push-pr');
    expect(commandText['ship.md']).toContain('commit-commands:clean_gone');
  });
});

describe('read-only promise (C12)', () => {
  // @clause C12
  it('C12: the gate and board CLIs contain no filesystem write calls', () => {
    for (const script of ['scripts/gate.mjs', 'scripts/board.mjs', 'scripts/lib/gate.mjs', 'scripts/lib/state.mjs']) {
      const src = readText(script);
      expect(src, `${script} must stay read-only`).not.toMatch(/writeFileSync|appendFileSync|writeFile\(|appendFile\(|rmSync|unlinkSync|renameSync/);
    }
    const gateCli = readText('scripts/gate.mjs');
    expect(gateCli).not.toMatch(/mkdirSync/);
  });

  // @clause C12
  it('C12: the gate command tells the truth about writing nothing', () => {
    expect(commandText['gate.md']).toMatch(/read-only|writes nothing/i);
    expect(commandText['next.md']).toMatch(/only command that writes|the only command/i);
  });
});

describe('no waivers (C17)', () => {
  // @clause C17
  it('C17: no command offers a force flag, and "waiver" appears only negated ("no waiver…")', () => {
    expect(allCommandText).not.toMatch(/--force/);
    expect(allCommandText).not.toMatch(/(?<!no )waivers?/i);
    expect(commandText['ship.md']).toMatch(/unconditionally/);
  });
});

describe('gate enumeration reference (C20)', () => {
  // @clause C20
  it('C20: gates.md enumerates a gate for all seven lifecycle phases', () => {
    for (const phase of ['define', 'contract', 'design', 'build', 'verify', 'ship', 'operate']) {
      expect(gatesRef).toMatch(new RegExp(`^\\| ${phase} \\|`, 'm'));
    }
    expect(gatesRef).toContain('any one of its checks fails');
  });
});
