// Control Surfaces Lab — the shared world every era runs against.
//
// One task, one deterministic environment. The only thing that changes
// between eras is the CONTROL PLANE config (see eras.mjs): which lever the
// engineer actually holds — the words, what goes into the window, or the
// loop itself.

export const TASK = {
  id: 'prepare-v2-4-release',
  summary:
    'Prepare the v2.4 release: write a correctly formatted changelog entry, ' +
    'bump VERSION, and leave the release checks green.',
};

// The pool of things you COULD send. Every doc costs window budget.
// `pinned` docs are mandatory (system prompt, user request); the rest are
// the curator's problem — or the scissor's, in era 1.
export const DOCUMENT_POOL = [
  { id: 'system-prompt',      cost: 2, pinned: true,  note: 'role + output rules' },
  { id: 'user-request',       cost: 1, pinned: true,  note: '"prepare the v2.4 release"' },
  { id: 'api-migration-notes', cost: 8, pinned: false, note: 'unrelated to this task' },
  { id: 'marketing-glossary', cost: 5, pinned: false, note: 'unrelated to this task' },
  { id: 'changelog-spec',     cost: 3, pinned: false, note: 'REQUIRED format for the entry' },
  { id: 'release-policy',     cost: 4, pinned: false, note: 'release checklist + owners' },
  { id: 'prior-incident-log', cost: 6, pinned: false, note: 'unrelated history' },
];

export function docById(id) {
  const doc = DOCUMENT_POOL.find((d) => d.id === id);
  if (!doc) throw new Error(`unknown document: ${id}`);
  return doc;
}

// Ground truth the task is graded on. Each requirement names the lever that
// can reach it — the whole point of the lab.
export const REQUIREMENTS = [
  {
    id: 'changelogFormatted',
    label: 'Changelog matches the required format',
    reachableBy: 'window-contents', // changelog-spec must survive into the window
  },
  {
    id: 'versionBumped',
    label: 'VERSION bumped to 2.4.0',
    reachableBy: 'loop', // requires a tool that can touch the environment
  },
  {
    id: 'checksGreen',
    label: 'Release checks ran and passed',
    reachableBy: 'loop', // requires a tool AND a reason to keep calling it
  },
];

// The world the tools act on. Deterministic: checks pass only when VERSION
// is 2.4.0 AND the release channel is stable — so a real run needs at least
// two edits and two check runs.
export function createEnvironment() {
  return {
    files: {
      'VERSION': '2.3.0',
      'src/release-config.js': 'export const channel = "beta"; // stale',
      'CHANGELOG.md': '# Changelog\n',
    },
    checks: { ran: 0, lastResult: null, lastFailure: null },
  };
}

export const KNOWN_TOOLS = ['edit-file', 'run-checks'];

export function applyTool(env, name, args = {}) {
  if (name === 'edit-file') {
    if (!(args.path in env.files)) {
      return { ok: false, result: `no such file: ${args.path}` };
    }
    env.files[args.path] = args.content;
    return { ok: true, result: `wrote ${args.path}` };
  }
  if (name === 'run-checks') {
    env.checks.ran += 1;
    const versionOk = env.files['VERSION'] === '2.4.0';
    const channelOk = env.files['src/release-config.js'].includes('stable');
    env.checks.lastResult = versionOk && channelOk ? 'pass' : 'fail';
    env.checks.lastFailure = env.checks.lastResult === 'pass'
      ? null
      : !versionOk
        ? 'VERSION is not 2.4.0'
        : 'release channel still "beta" — expected "stable"';
    return { ok: true, result: `checks ${env.checks.lastResult}` };
  }
  return { ok: false, result: `unknown tool: ${name}` };
}
