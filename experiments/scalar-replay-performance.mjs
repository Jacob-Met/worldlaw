/** Compare the actual input-only session consumer with a separately retained source. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length+3);
const hash = value => createHash('sha256').update(value).digest('hex');

if (arg('session-module')) {
  const api = await import(pathToFileURL(resolve(arg('session-module'))));
  const raw = readFileSync(arg('input'), 'utf8'), input = JSON.parse(raw);
  const cpuStart = process.cpuUsage(), start = performance.now();
  let state = api.createSession(input.dataset, input.initialOptions);
  const created = performance.now();
  for (const options of input.revisions) state = api.refitSession(state, options);
  const revised = performance.now();
  const notebook = api.exportSession(state), exported = performance.now();
  const replay = api.restoreSession(notebook), reopened = performance.now();
  const result = JSON.stringify(state), replayResult = JSON.stringify(replay);
  assert.equal(replayResult, result, 'ordinary input-only replay must reproduce every result');
  const cpu = process.cpuUsage(cpuStart);
  console.log(JSON.stringify({inputSha256:hash(raw), notebookSha256:hash(notebook), resultSha256:hash(result),
    rows:state.discovery.observations.length, events:state.events.length, candidates:state.discovery.candidates.length,
    selected:state.discovery.selected.id, createMs:created-start, revisionsMs:revised-created,
    exportMs:exported-revised, replayMs:reopened-exported, totalMs:reopened-start,
    cpuMs:(cpu.user+cpu.system)/1000, maxRssKiB:process.resourceUsage().maxRSS, node:process.version}));
} else {
  if (!arg('baseline-root')) throw new Error('Supply --baseline-root=/absolute/path/to/retained/source');
  const out = resolve(arg('output-dir') || '.receipts/scalar-replay');
  mkdirSync(out, {recursive:true});
  const count = Number(arg('rows') || 4096), repeats = Number(arg('repeats') || 3);
  assert.ok(Number.isInteger(count) && count >= 8 && count <= 4096);
  assert.ok(Number.isInteger(repeats) && repeats >= 1 && repeats <= 9);
  const row = i => {
    const command = Math.sin(i*1.13)*3, position = Math.sin(i*.741)*2.5, rate = Math.cos(i*1.723)*2;
    return {command,position,rate,jointTorque:1.3*command-.2*rate-3.1*Math.sin(position)+.03*Math.cos(i*.823)};
  };
  const input = {dataset:{schema:'worldlaw.observations/v1',
    source:{label:'Authored full-size scalar replay control',kind:'authored-numerical-control'},
    observations:Array.from({length:count},(_,i)=>row(i)), heldOut:Array.from({length:31},(_,i)=>row(i+10001))},
    initialOptions:{noiseSigma:.01,maxTerms:4,ambiguityDelta:6},
    revisions:Array.from({length:24},(_,i)=>({noiseSigma:[.001,.02,.2,1][i%4], ambiguityDelta:[0,6,30][i%3]}))};
  const inputPath = resolve(out,'input.json');
  writeFileSync(inputPath,JSON.stringify(input)+'\n');
  const modules = {baseline:resolve(arg('baseline-root'),'src/session.mjs'), candidate:resolve('src/session.mjs')};
  const records = [];
  // Alternate order to reduce systematic warm-host ordering effects. Every
  // measurement still has a fresh process and recomputes its original inputs.
  for (let repeat=0; repeat<repeats; repeat++) {
    for (const variant of repeat%2 ? ['candidate','baseline'] : ['baseline','candidate']) {
      const child = spawnSync(process.execPath, [resolve('experiments/scalar-replay-performance.mjs'),
        `--session-module=${modules[variant]}`, `--input=${inputPath}`], {encoding:'utf8',timeout:120000,maxBuffer:2000000});
      assert.ifError(child.error);
      assert.equal(child.status,0,child.stderr || child.error?.message || 'benchmark child failed');
      records.push({variant,repeat,...JSON.parse(child.stdout)});
    }
  }
  for (const key of ['inputSha256','notebookSha256','resultSha256'])
    assert.equal(new Set(records.map(row=>row[key])).size,1,`all original ${key} values must agree exactly`);
  const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
  const summary = Object.fromEntries(Object.keys(modules).map(variant => [variant,
    Object.fromEntries(['createMs','revisionsMs','replayMs','totalMs','cpuMs','maxRssKiB'].map(metric =>
      [metric,median(records.filter(row=>row.variant===variant).map(row=>row[metric]))]))]));
  const receipt = {scope:'Actual maintained scalar input-only session consumer, authored numerical source; no physical measurement or browser claim.',
    rows:count,revisionCount:24,repeats,inputSha256:records[0].inputSha256,summary,
    replaySpeedup:summary.baseline.replayMs/summary.candidate.replayMs,records};
  writeFileSync(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt,null,2));
}
