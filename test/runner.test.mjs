import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runEra } from '../public/runner.mjs';
import { validateConfig } from '../public/eras.mjs';
import { DOCUMENT_POOL, createEnvironment, applyTool } from '../public/pool.mjs';

const EXAMPLES = fileURLToPath(new URL('../examples/configs', import.meta.url));
const load = (name) => JSON.parse(readFileSync(`${EXAMPLES}/${name}`, 'utf8'));

test('example configs load and validate', () => {
  for (const f of ['era-1-prompt.json', 'era-2-context.json', 'era-3-harness.json', 'era-2-tight-budget.json']) {
    assert.deepEqual(validateConfig(load(f)), [], f);
  }
});

test('tight budget: era 2 fails when the spec does not fit', () => {
  const r = runEra(load('era-2-tight-budget.json'));
  assert.equal(r.requirements.changelogFormatted, false);
  assert.equal(r.requirements.versionBumped, true); // tools still reach the file
  assert.equal(r.termination, 'model-declared-done');
});

test('window budget is a hard wall — overspending selection is rejected', () => {
  const bad = {
    era: 2,
    name: 'greedy',
    control: 'what goes in',
    window: {
      capacity: 6,
      admission: 'curated',
      selected: ['system-prompt', 'user-request', 'changelog-spec'], // cost 6... plus pinned? no: exactly 6
    },
    tools: [],
    verifier: null,
    memory: 'none',
    maxTurns: 3,
  };
  assert.deepEqual(validateConfig(bad), []); // 6 ≤ 6 fits
  bad.window.selected.push('release-policy'); // 10 > 6
  const errors = validateConfig(bad);
  assert.ok(errors.some((e) => /budget is a hard wall/.test(e)));
});

test('fixed-order admission is a strict prefix cut (the scissors)', () => {
  // capacity exactly covers pool order up to a boundary
  const cfg = {
    era: 1, name: 'x', control: 'the words',
    window: { capacity: 3, admission: 'fixed-order' },
    tools: [], verifier: null, memory: 'none', maxTurns: 1,
  };
  const r = runEra(cfg);
  assert.deepEqual(r.trace[0].windowDocs, ['system-prompt', 'user-request']);
  assert.equal(r.trace[0].truncated.length, DOCUMENT_POOL.length - 2);
});

test('raw history competes with curated docs for budget', () => {
  const cfg = {
    era: 2, name: 'x', control: 'what goes in',
    window: { capacity: 11, admission: 'curated',
      selected: ['system-prompt', 'user-request', 'changelog-spec', 'release-policy'] },
    tools: ['edit-file'], verifier: null, memory: 'raw-history', maxTurns: 6,
  };
  const r = runEra(cfg);
  // turn 2: docs cost 10, one history item costs 1 → fits (11).
  assert.equal(r.trace[1].tokens, 11);
  assert.equal(r.trace[1].survivors.length, 1);
});

test('environment: checks fail until VERSION and channel are both right', () => {
  const env = createEnvironment();
  applyTool(env, 'run-checks');
  assert.equal(env.checks.lastResult, 'fail');
  applyTool(env, 'edit-file', { path: 'VERSION', content: '2.4.0' });
  applyTool(env, 'run-checks');
  assert.equal(env.checks.lastResult, 'fail'); // channel still beta
  applyTool(env, 'edit-file', { path: 'src/release-config.js', content: 'export const channel = "stable";' });
  applyTool(env, 'run-checks');
  assert.equal(env.checks.lastResult, 'pass');
});

test('invalid configs are rejected before running', () => {
  assert.throws(() => runEra({ era: 9 }), /invalid era config/);
});
