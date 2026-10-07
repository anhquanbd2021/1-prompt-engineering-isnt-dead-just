// Control Surfaces Lab — the scripted model.
//
// The SAME deterministic worker drives all three eras. It is deliberately
// mediocre — competent, not magical — because the lab's claim is that the
// outcome difference comes from the control surface, not the intelligence.
// The post's line: "at stage 3, the model is the least interesting part."
//
// The worker's private plan ends at "files updated" — like a real model, it
// has no intrinsic reason to keep working once its plan looks done. Only a
// verifier in the loop turns "checks green" into a step it must take.

export function createModel() {
  return { name: 'scripted-worker-v1' };
}

// One decision per turn. `ctx` is exactly what the harness chose to expose:
// - windowDocs: ids of documents admitted this turn
// - tools:      tool names the config grants
// - verifier:   whether a verifier will judge the result (null in era 1/2)
// - memory:     what survived between turns per the config's memory policy
// - observed:   facts the worker established via tool results so far
export function decide(ctx) {
  const { windowDocs, tools, verifier, memory, observed } = ctx;

  // Step 1: bump VERSION — but only if a tool can reach the file.
  if (tools.includes('edit-file') && !observed.versionBumped) {
    return {
      type: 'tool',
      name: 'edit-file',
      args: { path: 'VERSION', content: '2.4.0' },
      rationale: 'task says release v2.4 — bump VERSION',
    };
  }

  // Steps below exist ONLY when a verifier is in the loop. Without one the
  // worker's plan is already "done" — nothing makes green checks a step.
  if (verifier) {
    if (observed.checks !== 'pass') {
      const stale = memory.find((m) => m.kind === 'check-failed');
      if (stale && !observed.channelFixed) {
        return {
          type: 'tool',
          name: 'edit-file',
          args: {
            path: 'src/release-config.js',
            content: 'export const channel = "stable";',
          },
          rationale: `memory says checks failed: ${stale.cause}`,
        };
      }
      return {
        type: 'tool',
        name: 'run-checks',
        args: {},
        rationale: 'verifier requires checks green — run them',
      };
    }
  }

  // Final answer: the changelog entry. Format is correct ONLY if the spec
  // survived into this turn's window — the scissor's verdict, not the model's.
  const hasSpec = windowDocs.includes('changelog-spec');
  const checksClaim = observed.checks === 'pass' ? 'checks: pass (verified)' : 'checks: pass';
  const text = hasSpec
    ? [
        '## [2.4.0] — release',
        '### Changed',
        '- release channel promoted to stable',
        `- verification: ${checksClaim}`,
      ].join('\n')
    : [
        'v2.4 is out!! big update, channel stuff changed,',
        `checks: ${checksClaim}`,
      ].join('\n');
  return {
    type: 'answer',
    text,
    usedSpec: hasSpec,
    claimsGreen: true,
    actuallyGreen: observed.checks === 'pass',
  };
}
