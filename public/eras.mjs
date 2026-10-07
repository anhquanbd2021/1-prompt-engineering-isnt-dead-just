// Control Surfaces Lab — the three eras as control-plane configs.
//
// Same task, same model, same window capacity. The ONLY difference is which
// lever the engineer controls. That is the whole argument of the article.

import { KNOWN_TOOLS, docById } from './pool.mjs';

export const ADMISSIONS = ['fixed-order', 'curated'];
export const MEMORY_POLICIES = ['none', 'raw-history', 'attempt-log'];

// Era 1 — PROMPT ENGINEERING. You control: the words.
// The window fills in pool order and the tail is cut — you get no say in
// what survives. No tools, no loop, no verifier, no memory. One answer.
export const ERA_1 = {
  era: 1,
  name: 'prompt-engineering',
  control: 'the words',
  window: { capacity: 12, admission: 'fixed-order' },
  tools: [],
  verifier: null,
  memory: 'none',
  maxTurns: 1,
};

// Era 2 — CONTEXT ENGINEERING. You control: what goes in.
// The curator selects docs inside a budget — every selected doc is charged
// on EVERY turn. Tools exist and their results return as history, but
// nobody engineered the loop: no verifier, no termination condition, and
// raw history competes with your curated docs for the same budget.
export const ERA_2 = {
  era: 2,
  name: 'context-engineering',
  control: 'what goes in',
  window: {
    capacity: 12,
    admission: 'curated',
    selected: ['system-prompt', 'user-request', 'changelog-spec', 'release-policy'],
  },
  tools: ['edit-file', 'run-checks'],
  verifier: null,
  memory: 'raw-history',
  maxTurns: 6,
};

// Era 3 — HARNESS ENGINEERING. You control: the loop.
// Same curated window, same tools — but now the loop is engineered: a
// verifier decides done, memory decides what survives between turns (the
// compact attempt-log, not the raw transcript), and a turn budget bounds
// the cost. The model is one node; the harness is the product.
export const ERA_3 = {
  era: 3,
  name: 'harness-engineering',
  control: 'the loop',
  window: {
    capacity: 12,
    admission: 'curated',
    selected: ['system-prompt', 'user-request', 'changelog-spec', 'release-policy'],
  },
  tools: ['edit-file', 'run-checks'],
  verifier: {
    assertions: [{ metric: 'checks.lastResult', op: '===', value: 'pass' }],
  },
  memory: 'attempt-log',
  maxTurns: 8,
};

export const ERAS = [ERA_1, ERA_2, ERA_3];

// The lever → reach matrix. What each control surface can and cannot touch.
// Note the last row's cannotReach: even era 3 never gets a window that
// stops truncating — the scissors stay; only your say over what survives grows.
export const LEVERS = [
  {
    era: 1,
    lever: 'the words',
    reaches: ['the answer text'],
    cannotReach: [
      'what enters the window',
      'the environment (no tools)',
      'verification of the output',
      'a second attempt',
    ],
  },
  {
    era: 2,
    lever: 'what goes in',
    reaches: ['grounded answers', 'tool results returning as history'],
    cannotReach: [
      'when the loop stops',
      'what survives between turns',
      'whether output is verified',
    ],
  },
  {
    era: 3,
    lever: 'the loop',
    reaches: [
      'environment changes via tools',
      'verified termination',
      'cross-turn memory',
      'bounded cost',
    ],
    cannotReach: ['a window that never truncates'],
  },
];

export function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') return ['config must be an object'];
  if (!Number.isInteger(config.era) || config.era < 1) errors.push('era must be a positive integer');
  if (typeof config.name !== 'string' || !config.name) errors.push('name is required');
  if (typeof config.control !== 'string' || !config.control) errors.push('control is required');

  const w = config.window;
  if (!w || typeof w !== 'object') {
    errors.push('window is required');
  } else {
    if (!Number.isInteger(w.capacity) || w.capacity <= 0) {
      errors.push('window.capacity must be a positive integer');
    }
    if (!ADMISSIONS.includes(w.admission)) {
      errors.push(`window.admission must be one of ${ADMISSIONS.join(', ')}`);
    }
    if (w.admission === 'curated') {
      if (!Array.isArray(w.selected) || w.selected.length === 0) {
        errors.push('curated admission requires window.selected[]');
      } else {
        let cost = 0;
        for (const id of w.selected) {
          try {
            cost += docById(id).cost;
          } catch {
            errors.push(`unknown selected doc: ${id}`);
          }
        }
        if (cost > w.capacity) {
          errors.push(`selected docs cost ${cost} > window capacity ${w.capacity} — the budget is a hard wall`);
        }
      }
    }
  }

  if (!Array.isArray(config.tools)) {
    errors.push('tools must be an array');
  } else {
    for (const t of config.tools) {
      if (!KNOWN_TOOLS.includes(t)) errors.push(`unknown tool: ${t}`);
    }
  }

  if (config.verifier !== null && (typeof config.verifier !== 'object' || !Array.isArray(config.verifier.assertions))) {
    errors.push('verifier must be null or { assertions: [...] }');
  }

  if (!MEMORY_POLICIES.includes(config.memory)) {
    errors.push(`memory must be one of ${MEMORY_POLICIES.join(', ')}`);
  }

  if (!Number.isInteger(config.maxTurns) || config.maxTurns < 1 || config.maxTurns > 20) {
    errors.push('maxTurns must be an integer 1..20');
  }
  return errors;
}
