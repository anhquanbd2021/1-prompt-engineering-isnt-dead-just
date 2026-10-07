// CLI: run all three era configs on the same task and print the
// side-by-side control-surface report.
//   node scripts/report.mjs            — the three built-in eras
//   node scripts/report.mjs <file>     — a custom era config (see examples/)

import { readFileSync } from 'node:fs';
import { ERAS, LEVERS, validateConfig } from '../public/eras.mjs';
import { runEra } from '../public/runner.mjs';
import { REQUIREMENTS } from '../public/pool.mjs';

const customPath = process.argv[2];
let configs = ERAS;
if (customPath) {
  const config = JSON.parse(readFileSync(customPath, 'utf8'));
  const errors = validateConfig(config);
  if (errors.length) {
    console.error(`invalid config ${customPath}:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  configs = [config];
}

const results = configs.map(runEra);

const pad = (s, n) => String(s).padEnd(n);
console.log('');
console.log('CONTROL SURFACES — one task, one model, three levers');
console.log('='.repeat(72));
console.log(`task: ${results[0].task}`);
console.log('');

console.log(pad('era', 26) + pad('control', 16) + pad('reqs', 6) + pad('tokens', 8) + 'termination');
console.log('-'.repeat(72));
for (const r of results) {
  console.log(
    pad(`${r.era}. ${r.name}`, 26) +
    pad(r.control, 16) +
    pad(r.requirementsMet, 6) +
    pad(r.tokensCharged, 8) +
    r.termination,
  );
}
console.log('');

console.log('requirement matrix');
console.log('-'.repeat(72));
console.log(pad('requirement', 42) + results.map((r) => pad(`era ${r.era}`, 8)).join(''));
for (const req of REQUIREMENTS) {
  console.log(
    pad(`${req.id} (${req.reachableBy})`, 42) +
    results.map((r) => pad(r.requirements[req.id] ? 'PASS' : 'fail', 8)).join(''),
  );
}
console.log('');
for (const r of results) {
  if (r.falseGreenClaim) {
    console.log(`! era ${r.era}: changelog claims "checks: pass" — checks never passed (false green)`);
  }
  const cut = [...new Set(r.trace.flatMap((t) => t.truncated))];
  if (cut.length) {
    console.log(`✂ era ${r.era}: truncated out of the window → ${cut.join(', ')}`);
  }
}
console.log('');

console.log('lever → reach');
console.log('-'.repeat(72));
for (const l of LEVERS) {
  console.log(`era ${l.era} — you control ${l.lever}`);
  console.log(`   reaches:     ${l.reaches.join('; ')}`);
  console.log(`   cannot reach: ${l.cannotReach.join('; ')}`);
}
console.log('');
console.log('Same model every run. The lever is the difference.');
