import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from '../src/science/active-linear-family.mjs';
import {pulseMenu, fixedPositionDriftCollision, positionDriftRegions,
  observePositionDrift, replayPositionDrift} from '../src/science/persistent-position-drift.mjs';

const {Q, add, sub, mul, div, fmt} = ACTIVE_LINEAR_EXACT_ARITHMETIC;
const q = s => { const [n,d='1'] = String(s).split('/'); return Q(BigInt(n), BigInt(d)); };
const laws = ['A','B','C','D'];
// Independent polynomial plant: on-rates are evaluated in the command
// coordinate; off is physical coasting. The two states evolve at every step.
const coefficients = [[0,0,0], [16,-24,8], [16,8,-8], [16,0,0]];
function forced(law, u) {
  if (u === 'off') return q(0);
  return coefficients[laws.indexOf(law)].reduceRight((s, c) => add(q(c),mul(q(u),s)),q(0));
}
function simulate(law, [position,drift], commands) {
  let p = q(position);
  const v = q(drift), out = [p];
  for (const u of commands) { p = add(add(p,v),forced(law,u)); out.push(p); }
  return out;
}
function* tapes(menu, n) {
  if (!n) { yield []; return; }
  for (const prefix of tapes(menu,n-1)) for (const u of menu) yield [...prefix,u];
}

test('all 64 fixed three-pulse tapes have constructive exact collisions', () => {
  let count = 0;
  for (const commands of tapes(pulseMenu,3)) {
    const [a,b] = fixedPositionDriftCollision(commands);
    assert.notEqual(a.law,b.law);
    const readings = simulate(a.law,a.start,commands).map(fmt);
    assert.deepEqual(readings,simulate(b.law,b.start,commands).map(fmt));
    const feasible = positionDriftRegions(commands,readings).map(r => r.law);
    assert.ok(feasible.includes(a.law) && feasible.includes(b.law));
    count++;
  }
  assert.equal(count,64);
});

test('even adaptive two-pulse designs collide on the common first prefix', () => {
  for (const commands of tapes(pulseMenu,2)) {
    const [a,b] = fixedPositionDriftCollision(commands);
    const paths = [a,b].map(({law}) => {
      const drift = fmt(sub(q(0),forced(law,commands[0])));
      return simulate(law,[0,drift],commands).map(fmt);
    });
    assert.deepEqual(paths[0].slice(0,2),['0','0']);
    assert.deepEqual(paths[0],paths[1]);
  }
});

test('three adaptive pulses identify every law on both starts and every {-1,0,1} noise vector', () => {
  let n = 0;
  for (const start of [[0,0],['-7/3','5/2']]) for (const law of laws) {
    for (const errors of tapes([-1,0,1],4)) {
      let readings = [fmt(add(q(start[0]),q(errors[0])))];
      const commands = [];
      for (let t = 1; t <= 3; t++) {
        const decision = observePositionDrift(readings).rounds.at(-1).next;
        assert.equal(decision.kind,'pulse');
        commands.push(decision.command);
        const y = simulate(law,start,commands).at(-1);
        readings.push(fmt(add(y,q(errors[t]))));
      }
      const record = observePositionDrift(readings);
      assert.deepEqual(record.commands,['off',1,['A','B'].includes(law)?0:2]);
      assert.deepEqual(record.rounds.at(-1).regions.map(r => r.law),[law]);
      for (const {tick,regions} of record.rounds) for (const r of regions) {
        const clean = simulate(r.law,r.initialWitness,commands.slice(0,tick));
        clean.forEach((y,i) => {
          const e = sub(q(readings[i]),y);
          assert.ok(e.n >= -e.d && e.n <= e.d);
        });
      }
      n++;
    }
  }
  assert.equal(n,648);
});

test('joint state strips retain dependence across overlapping feasible windows', () => {
  const coast = ['off','off'];
  assert.ok(positionDriftRegions(coast,[0,0,4]).length);
  assert.ok(positionDriftRegions(coast,[0,4,8]).length);
  assert.deepEqual(positionDriftRegions([...coast,'off'],[0,0,4,8]),[]);
  const edge = positionDriftRegions(coast,[0,0,4])[0];
  assert.deepEqual(edge.driftRange,['2','2']);
  assert.deepEqual(edge.initialWitness,['-1','2']);
  assert.deepEqual(positionDriftRegions(coast,[0,0,'401/100']),[]);
  assert.deepEqual(observePositionDrift([0,0,8]).rounds.at(-1),{tick:2,regions:[],next:{kind:'stop'}});
  assert.throws(() => observePositionDrift([0,0,8,8]),/stopped/);
});

test('independent bounded-polygon vertex enumeration agrees on all four-tick decisions', () => {
  // With two distinct ticks, the feasible position/drift set is bounded.
  // A nonempty bounded closed polygon (including segments/points) has a
  // vertex at the meeting of two nonparallel strip boundaries.
  function vertexFeasible(cmds, law, ys) {
    const forcing = simulate(law,[0,0],cmds);
    const z = ys.map((y,t) => sub(q(y),forcing[t]));
    for (let j=1;j<z.length;j++) for (let i=0;i<j;i++) {
      for (const ei of [-1,1]) for (const ej of [-1,1]) {
        const pi = add(z[i],q(ei)), pj = add(z[j],q(ej));
        const v = div(sub(pj,pi),q(j-i)), p = sub(pi,mul(q(i),v));
        if (z.every((y,t) => {
          const e = sub(y,add(p,mul(q(t),v)));
          return e.n >= -e.d && e.n <= e.d;
        })) return true;
      }
    }
    return false;
  }
  for (const cmds of tapes(pulseMenu,3)) for (const last of [-2,0,2,16,32,48]) {
    const ys = ['1/3','-2/3','4/3',last];
    const expected = laws.filter(law => vertexFeasible(cmds,law,ys));
    assert.deepEqual(positionDriftRegions(cmds,ys).map(r=>r.law),expected);
  }
});

test('saved observations replay each action and exact posterior, including large measurements', () => {
  const initial = 10n**24n;
  const record = observePositionDrift([initial, initial, initial+16n, initial+32n].map(String));
  assert.equal(record.rounds.at(-1).regions[0].law,'D');
  assert.deepEqual(replayPositionDrift(JSON.parse(JSON.stringify(record))),record);
  for (const change of [
    r => { r.commands[2] = 0; },
    r => { r.rounds[1].regions.pop(); },
    r => { r.rounds[2].regions[0].strips[2].lower = '0'; },
    r => { r.rounds[3].regions[0].initialWitness[1] = '7'; },
    r => { r.rounds[3].regions[0].driftRange[0] = '7'; },
    r => { r.readings[3] = String(initial+16n); },
  ]) {
    const corrupt = structuredClone(record); change(corrupt);
    assert.throws(() => replayPositionDrift(corrupt),/exact replay/);
  }
});
