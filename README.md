# Control Surfaces Lab

One task, one scripted model, three era configs — a zero-dependency Node 20+
lab that makes the prompt → context → harness engineering progression
executable. The only thing that changes between runs is **which lever the
engineer holds**, so the outcome difference *is* the argument.

Companion to the LinkedIn article "Prompt Engineering Isn't Dead — It Just
Stopped Being the Job."

## Run it

```bash
npm start          # serves the lab UI on :3000 (PORT env to override)
npm run report     # CLI side-by-side of all three eras
npm test           # node --test "test/*.test.mjs"
npm run check      # tests + report (Render buildCommand)
```

Custom config:

```bash
node scripts/report.mjs examples/configs/era-2-tight-budget.json
```

## What it proves

Same task (prepare the v2.4 release: formatted changelog, bumped VERSION,
green checks), same deterministic worker (`public/model.mjs`):

| era | you control | requirements | termination |
|---|---|---|---|
| 1 prompt engineering | the words | 0/3 | single-shot |
| 2 context engineering | what goes in | 2/3 | model-declared-done |
| 3 harness engineering | the loop | 3/3 | verifier-passed |

- Era 1's fixed-order window admits an irrelevant doc and **scissors the
  changelog spec** — the engineer had no say in what survived. With no
  tools it can't touch the environment, and it still *claims* green checks.
- Era 2's curated window grounds the changelog and the edit tool bumps
  VERSION — but nothing engineered the stop, so the worker declares done
  without ever running the checks. Every curated doc is charged on every
  turn (21 tokens vs era 1's 11).
- Era 3 adds the loop: verifier (`checks.lastResult === "pass"`), an
  attempt-log memory that carries the failure's cause between turns, and a
  turn budget. It fails checks once, remembers why, fixes the channel, and
  terminates on `verifier-passed` — not on a feeling.

The lever → reach matrix (`public/eras.mjs`) is the takeaway: even era 3
cannot reach "a window that never truncates." The scissors stay; only your
say over what survives grows.

## Key files

- `public/pool.mjs` — document pool, task, environment, requirements
- `public/model.mjs` — the scripted worker (same for every era)
- `public/eras.mjs` — the three control-plane configs + lever matrix + validator
- `public/runner.mjs` — the harness: admission, charging, tools, verifier, trace
- `scripts/report.mjs` — CLI report; accepts a custom config path
- `examples/configs/` — the three era configs as editable JSON + a
  tight-budget era-2 variant that fails on budget

## Honest limits

- **The model is scripted, not an LLM.** That's the point — holding the
  intelligence constant isolates the control surface — but it means the lab
  demonstrates *reach*, not real-world difficulty. A real model in era 1 can
  still produce a decent changelog by luck; the lab shows what the lever can
  *guarantee*.
- **Token costs are abstract units**, roughly proportional to real costs but
  not measured against any tokenizer.
- **The environment is a toy**: three files, two checks. Real harnesses add
  auth, sandboxes, retries, budgets in dollars — the axes are the same, the
  stakes are not.
- **Era boundaries are a simplification.** Real systems mix eras (a harness
  still needs good prompt text). The lab exaggerates the separation to make
  each lever visible.
