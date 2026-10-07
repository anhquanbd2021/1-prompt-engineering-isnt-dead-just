// Control Surfaces Lab — the harness that runs one era config against the
// shared task and reports what that control surface could actually reach.
//
// Nothing here is a real LLM. The model is scripted (model.mjs) so that the
// ONLY variable between runs is the control-plane config — which is the
// entire claim being demonstrated.

import {
  DOCUMENT_POOL,
  REQUIREMENTS,
  TASK,
  applyTool,
  createEnvironment,
  docById,
} from './pool.mjs';
import { decide } from './model.mjs';
import { validateConfig } from './eras.mjs';

const HISTORY_ITEM_COST = 1; // every history/memory item costs window budget

// --- window admission -----------------------------------------------------
// 'fixed-order': docs enter in pool order while they fit; the first doc that
//   overflows cuts it AND everything after — the scissors. You get no say.
// 'curated': the engineer's selected docs are guaranteed (validation already
//   proved they fit); survivors between turns (history or attempt-log,
//   per memory policy) fill whatever budget remains, newest first, and the
//   overflow is logged as truncated.
function admitDocs(config, history, memory) {
  const { capacity, admission } = config.window;
  const admitted = [];
  const truncated = [];

  if (admission === 'fixed-order') {
    let used = 0;
    let cutting = false;
    for (const doc of DOCUMENT_POOL) {
      if (!cutting && used + doc.cost <= capacity) {
        admitted.push(doc.id);
        used += doc.cost;
      } else {
        cutting = true;
        truncated.push(doc.id);
      }
    }
    return { windowDocs: admitted, survivors: [], truncated, tokens: used };
  }

  // curated
  let used = 0;
  for (const id of config.window.selected) {
    admitted.push(id);
    used += docById(id).cost;
  }
  const candidates =
    config.memory === 'attempt-log'
      ? memory.map((m) => ({ id: `memory:${m.kind}`, cost: HISTORY_ITEM_COST, ref: m }))
      : config.memory === 'raw-history'
        ? [...history].reverse().map((h) => ({ id: `history:${h.summary}`, cost: HISTORY_ITEM_COST, ref: h }))
        : [];
  const survivors = [];
  for (const item of candidates) {
    if (used + item.cost <= capacity) {
      survivors.push(item.id);
      used += item.cost;
    } else {
      truncated.push(item.id);
    }
  }
  return { windowDocs: admitted, survivors, truncated, tokens: used };
}

// --- verifier -------------------------------------------------------------
function readMetric(env, metric) {
  if (metric === 'checks.lastResult') return env.checks.lastResult;
  if (metric === 'checks.ran') return env.checks.ran;
  if (metric.startsWith('file:')) return env.files[metric.slice(5)];
  return undefined;
}

function verifierPasses(config, env) {
  if (!config.verifier) return false;
  return config.verifier.assertions.every((a) => {
    const got = readMetric(env, a.metric);
    if (a.op === '===') return got === a.value;
    if (a.op === '>=') return typeof got === 'number' && got >= a.value;
    return false;
  });
}

// --- observed state (what the worker has established via tool results) ----
function observe(env) {
  return {
    versionBumped: env.files['VERSION'] === '2.4.0',
    channelFixed: env.files['src/release-config.js'].includes('stable'),
    checks: env.checks.lastResult,
  };
}

// --- the run ---------------------------------------------------------------
export function runEra(config) {
  const errors = validateConfig(config);
  if (errors.length) {
    throw new Error(`invalid era config: ${errors.join('; ')}`);
  }

  const env = createEnvironment();
  const history = []; // raw transcript — every tool call and result
  const memory = []; // attempt-log — compact notes the harness chose to keep
  const trace = [];
  let tokensCharged = 0;
  let answer = null;
  let termination = 'budget-exhausted';

  for (let turn = 1; turn <= config.maxTurns; turn += 1) {
    const { windowDocs, survivors, truncated, tokens } = admitDocs(config, history, memory);
    tokensCharged += tokens;

    const step = decide({
      windowDocs,
      tools: config.tools,
      verifier: config.verifier,
      memory,
      observed: observe(env),
    });

    const entry = { turn, windowDocs, survivors, truncated, tokens, action: step };

    if (step.type === 'answer') {
      answer = step;
      entry.result = 'final answer';
      termination = config.maxTurns === 1 ? 'single-shot' : 'model-declared-done';
      trace.push(entry);
      break;
    }

    // tool call — the environment answers, the result becomes history
    const applied = applyTool(env, step.name, step.args);
    entry.result = applied.result;
    history.push({ turn, summary: `${step.name} → ${applied.result}`, cost: HISTORY_ITEM_COST });

    if (step.name === 'run-checks' && env.checks.lastResult === 'fail') {
      memory.push({ kind: 'check-failed', cause: env.checks.lastFailure, turn });
    }

    const verdict = verifierPasses(config, env);
    entry.verifier = config.verifier ? (verdict ? 'pass' : 'fail') : null;
    trace.push(entry);

    if (verdict) {
      termination = 'verifier-passed';
      // Loop done — the worker produces its closing answer in the same window.
      const finalStep = decide({
        windowDocs,
        tools: config.tools,
        verifier: config.verifier,
        memory,
        observed: observe(env),
      });
      if (finalStep.type === 'answer') {
        answer = finalStep;
        trace.push({ turn: `${turn}+final`, windowDocs, survivors, truncated, tokens: 0, action: finalStep, result: 'closing answer' });
      }
      break;
    }
  }

  const requirements = {
    changelogFormatted: Boolean(answer && answer.usedSpec),
    versionBumped: env.files['VERSION'] === '2.4.0',
    checksGreen: env.checks.lastResult === 'pass',
  };
  const met = REQUIREMENTS.filter((r) => requirements[r.id]).length;

  return {
    task: TASK.id,
    era: config.era,
    name: config.name,
    control: config.control,
    turns: trace.filter((t) => typeof t.turn === 'number').length,
    termination,
    tokensCharged,
    requirements,
    requirementsMet: `${met}/${REQUIREMENTS.length}`,
    falseGreenClaim: Boolean(answer && answer.claimsGreen && !answer.actuallyGreen),
    answerPreview: answer ? answer.text : '(no answer — budget exhausted)',
    trace,
  };
}

export function runAll(configs) {
  return configs.map(runEra);
}
