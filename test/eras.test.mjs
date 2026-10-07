import test from 'node:test';
import assert from 'node:assert/strict';
import { ERAS, ERA_1, ERA_2, ERA_3, LEVERS, validateConfig } from '../public/eras.mjs';
import { runEra } from '../public/runner.mjs';

test('built-in era configs are valid', () => {
  for (const era of ERAS) {
    assert.deepEqual(validateConfig(era), []);
  }
});

test('era 1 (prompt engineering): the words lever reaches almost nothing', () => {
  const r = runEra(ERA_1);
  assert.equal(r.turns, 1);
  assert.equal(r.termination, 'single-shot');
  // The scissors admitted an irrelevant doc and cut the spec —
  // the engineer had no say in what survived.
  const cut = r.trace[0].truncated;
  assert.ok(cut.includes('changelog-spec'), 'spec truncated in era 1');
  assert.ok(r.trace[0].windowDocs.includes('api-migration-notes'), 'irrelevant doc admitted');
  // No tools → cannot touch the environment at all.
  assert.equal(r.requirements.versionBumped, false);
  assert.equal(r.requirements.checksGreen, false);
  assert.equal(r.requirements.changelogFormatted, false);
  assert.equal(r.requirementsMet, '0/3');
  // …and it still claims the checks are green.
  assert.equal(r.falseGreenClaim, true);
});

test('era 2 (context engineering): curated window grounds the answer, loop stays unengineered', () => {
  const r = runEra(ERA_2);
  assert.equal(r.termination, 'model-declared-done');
  // Curation worked: spec survived → correct format; edit tool → VERSION bumped.
  assert.equal(r.requirements.changelogFormatted, true);
  assert.equal(r.requirements.versionBumped, true);
  // But nobody engineered the stop: checks never ran, and the model
  // declared done on its own say-so — with a false green in the changelog.
  assert.equal(r.requirements.checksGreen, false);
  assert.equal(r.requirementsMet, '2/3');
  assert.equal(r.falseGreenClaim, true);
  // Budget accounting: curated docs are charged on EVERY turn.
  assert.equal(r.trace[0].tokens, 10);
  assert.equal(r.tokensCharged, 21); // 10 + (10 docs + 1 history item)
});

test('era 3 (harness engineering): the loop reaches verified termination', () => {
  const r = runEra(ERA_3);
  assert.equal(r.termination, 'verifier-passed');
  assert.deepEqual(r.requirements, {
    changelogFormatted: true,
    versionBumped: true,
    checksGreen: true,
  });
  assert.equal(r.requirementsMet, '3/3');
  assert.equal(r.falseGreenClaim, false);
  // The loop iterated: checks failed once, memory carried the cause,
  // the worker fixed the channel, re-ran checks → pass.
  const toolCalls = r.trace.filter((t) => t.action.type === 'tool');
  assert.equal(toolCalls.length, 4);
  assert.equal(toolCalls[1].action.name, 'run-checks');
  assert.equal(toolCalls[1].result, 'checks fail');
  const fixStep = toolCalls[2];
  assert.equal(fixStep.action.name, 'edit-file');
  assert.match(fixStep.action.rationale, /memory says checks failed/);
  assert.equal(toolCalls[3].result, 'checks pass');
});

test('lever matrix: era 3 still cannot reach a non-truncating window', () => {
  const era3 = LEVERS.find((l) => l.era === 3);
  assert.ok(era3.cannotReach.includes('a window that never truncates'));
  const era1 = LEVERS.find((l) => l.era === 1);
  assert.ok(era1.cannotReach.includes('verification of the output'));
});

test('same model across eras — only the control surface changes', () => {
  const results = ERAS.map(runEra);
  assert.deepEqual(
    results.map((r) => r.requirementsMet),
    ['0/3', '2/3', '3/3'],
  );
});
