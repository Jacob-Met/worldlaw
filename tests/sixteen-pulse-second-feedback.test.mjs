import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {receiver} from '../scripts/sixteen-pulse-second-feedback.mjs';

const read = name => JSON.parse(readFileSync(new URL('../examples/' + name, import.meta.url)));
const source = read('active-position-drift-sixteen-pulse-upper.json');
const packet = read('sixteen-pulse-second-feedback.json');
const commands = source.catalog.commands;

test('all tenth commands have one common response for all committed six-action tails', () => {
  const r = receiver(source, packet);
  assert.deepEqual(r.verify(), {cases:13728, physicalPairs:156});
  assert.deepEqual(r.respond(), {ninth:'27/128'});
  assert.throws(() => r.respond('x0', ['x0']), /complete/);
  assert.throws(() => r.respond('x0', Array(6).fill('absent')), /Unknown/);
  const bad = structuredClone(packet);
  bad.children[2].reading = '50';
  assert.throws(() => receiver(source, bad), /misses/);
});

test('independent source-coordinate replay covers different orders, repeats and both early marks', () => {
  const r = receiver(source, packet);
  const exact = value => {
    const [a, b = '1'] = value.split('/');
    return [BigInt(a), BigInt(b)];
  };
  for (let c = 0; c < 8; c++) {
    const tails = [Array(6).fill(commands[c]), commands.slice(0, 6),
                   commands.slice(0, 6).reverse(), [commands[7], commands[c], 'ref', 'ref', 'x1', 'z0']];
    const early = r.respond(commands[c]);
    for (const tail of tails) {
      const replay = r.respond(commands[c], tail);
      assert.deepEqual([replay.readings[9],replay.readings[10]], [early.ninth,early.tenth]);
      const tape = [...Array(8).fill('ref'), 'x0', commands[c], ...tail];
      for (const [l, law] of replay.laws.entries()) {
        const values = [...law.weights, law.origin, law.drift, ...replay.readings].map(exact);
        const d = values.reduce((n, [, b]) => n*b, 32n);
        const x = values.map(([a,b]) => a*(d/b));
        const weights = x.slice(0,4);
        assert.equal(weights.reduce((a,b) => a+b,0n),d);
        let pos = x[4];
        for (let t = 0; t <= tape.length; t++) {
          const error = pos - x[6+t];
          assert.ok(32n*error >= -5n*d && 32n*error <= 5n*d);
          if (t < tape.length) {
            const j = commands.indexOf(tape[t]);
            pos += weights.reduce((s,w,i) => s + w*BigInt(source.catalog.laws[l].vertices[i][j]),x[5]);
          }
        }
      }
    }
  }
  const cli = spawnSync(process.execPath, ['scripts/sixteen-pulse-second-feedback.mjs','x0'], {encoding:'utf8'});
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout), {ninth:'27/128',tenth:'27/64'});
});
