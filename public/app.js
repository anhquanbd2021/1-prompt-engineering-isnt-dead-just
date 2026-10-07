import { ERAS, LEVERS } from './eras.mjs';
import { runEra } from './runner.mjs';
import { REQUIREMENTS } from './pool.mjs';

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

function renderResults(results) {
  const grid = $('#eras');
  grid.innerHTML = '';
  for (const r of results) {
    const card = el('div', 'era-card');
    card.append(el('h3', null, `Era ${r.era}: ${r.name}`));
    card.append(el('p', 'control', `you control: ${r.control}`));
    const met = Number(r.requirementsMet.split('/')[0]);
    card.append(el('p', `score ${met === 3 ? 'ok' : 'bad'}`, r.requirementsMet));
    const dl = el('dl');
    const rows = [
      ['termination', r.termination],
      ['turns', r.turns],
      ['tokens charged', r.tokensCharged],
    ];
    for (const [k, v] of rows) {
      dl.append(el('dt', null, k));
      dl.append(el('dd', null, v));
    }
    card.append(dl);
    if (r.falseGreenClaim) {
      card.append(el('p', 'flag', '✗ claims "checks: pass" — checks never passed'));
    }
    const cut = [...new Set(r.trace.flatMap((t) => t.truncated))];
    if (cut.length) {
      card.append(el('p', 'cut', `✂ cut out of the window: ${cut.join(', ')}`));
    }
    grid.append(card);
  }

  const tbody = $('#matrix tbody');
  tbody.innerHTML = '';
  const head = $('#matrix thead tr');
  head.innerHTML = '<th>requirement</th><th>reachable by</th>' +
    results.map((r) => `<th>era ${r.era}</th>`).join('');
  for (const req of REQUIREMENTS) {
    const tr = el('tr');
    tr.append(el('td', null, req.label));
    tr.append(el('td', null, req.reachableBy));
    for (const r of results) {
      const ok = r.requirements[req.id];
      tr.append(el('td', ok ? 'pass' : 'fail', ok ? 'PASS' : 'fail'));
    }
    tbody.append(tr);
  }

  const levers = $('#levers');
  levers.innerHTML = '';
  for (const l of LEVERS) {
    const box = el('div', 'lever');
    box.append(el('strong', null, `era ${l.era} — you control ${l.lever}`));
    const r = el('ul');
    for (const x of l.reaches) r.append(el('li', null, `✓ ${x}`));
    box.append(el('em', null, 'reaches:')).append;
    box.append(r);
    const c = el('ul');
    for (const x of l.cannotReach) c.append(el('li', null, `✗ ${x}`));
    box.append(el('em', null, 'cannot reach:'));
    box.append(c);
    levers.append(box);
  }

  const trace = $('#trace');
  trace.innerHTML = '';
  for (const r of results) {
    const wrap = el('div', 'trace-era');
    wrap.append(el('h3', null, `era ${r.era} — ${r.termination}`));
    for (const t of r.trace) {
      const line = el('div', 'turn');
      const action = t.action.type === 'tool'
        ? `tool ${t.action.name}(${JSON.stringify(t.action.args)}) → ${t.result}`
        : `answer ${t.action.usedSpec ? '[spec format]' : '[no spec]'}`;
      const verdict = t.verifier ? ` | verifier: ${t.verifier}` : '';
      line.textContent = `t${t.turn} | window[${t.windowDocs.join(', ')}] ${t.tokens}tok | ${action}${verdict}`;
      wrap.append(line);
    }
    trace.append(wrap);
  }
}

$('#run').addEventListener('click', () => {
  const results = ERAS.map(runEra);
  renderResults(results);
  $('#app').hidden = false;
});
