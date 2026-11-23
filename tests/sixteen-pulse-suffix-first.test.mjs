import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {suffixFirstReceiver,checkReordering} from '../scripts/sixteen-pulse-suffix-first.mjs';

const read=name => JSON.parse(readFileSync(new URL('../examples/'+name,import.meta.url)));
const source=read('active-position-drift-sixteen-pulse-upper.json');
const packet=read('sixteen-pulse-suffix-first.json');
const opening=packet.opening.map(i=>source.catalog.commands[i]);

test('all continuations and both reordered duals pass independent source-coordinate arithmetic', () => {
  const py=`from fractions import Fraction as F
from itertools import combinations_with_replacement,product
from math import factorial,prod
import base64,json
s=json.load(open('examples/active-position-drift-sixteen-pulse-upper.json'))['catalog']
p=json.load(open('examples/sixteen-pulse-suffix-first.json'))
raw=[v['vertices'] for v in s['laws']]
mu=[sum(F(w,12)*v[j] for weights,law in zip(([1,2,1,2],[2,1,2,1]),raw) for w,v in zip(weights,law)) for j in range(8)]
prefix=p['opening'];assert prefix==[6,3,4,4,2,5,7,2]
pairs=[]
for scale,*vals in p['pairs']:
    e=scale*5//32; shifted=-scale//18
    center=[int(q*scale) for q in mu];worlds=[]
    for l in (0,1):
        weights=vals[3*l:3*l+3];weights.append(scale-sum(weights));assert min(weights)>=0
        origin,drift=vals[6+2*l:8+2*l]
        rates=[drift+sum(w*v[j] for w,v in zip(weights,raw[l])) for j in range(8)]
        clean=origin;display=0
        assert abs(clean)<=e
        for i,c in enumerate(prefix):
            clean+=rates[c];display+=center[c]
            if i==7:display+=shifted
            assert abs(clean-display)<=e
        worlds.append((clean,rates,display,[a-b for a,b in zip(rates,center)]))
    pairs.append((e,worlds))
ids=base64.b64decode(p['assignments'],validate=True);splits=dict(p['terminalSplits'])
count=0
for i,tail in enumerate(combinations_with_replacement(range(8),8)):
    h=[tail.count(c) for c in range(8)];count+=factorial(8)//prod(factorial(n) for n in h)
    for last in set(tail):
        pair=splits[i][last] if ids[i]==255 else ids[i];e,worlds=pairs[pair]
        h[last]-=1;term=[]
        for clean,rates,display,steps in worlds:
            # Evaluate every box vertex; a linear residual attains its extrema there.
            corners=[(0,n*d) for n,d in zip(h,steps) if n]
            assert all(abs(clean-display+sum(a))<=e for a in product(*corners))
            term.append(clean+sum(a*r for a,r in zip(h,rates))+rates[last])
        h[last]+=1;assert abs(term[0]-term[1])<=2*e
assert i+1==6435 and count==8**8
r=p['reordered'];word=r['opening']+[0]*8;assert sorted(word[:8])==sorted(prefix)
for cert in r['certificates']:
    totals=[F(0)]*13;rhs=F(0)
    for (t,l,sign),n in cert['weights']:
        m=F(n,cert['noiseWeight']);assert m>0
        if t=='mass':
            rhs+=m*sign
            for j in range(4):totals[4*l+j]+=m*sign
            continue
        for law in ([0,1] if l==2 else [l]):
            a=m*sign*(-1 if l==2 and law==1 else 1)
            for j,v in enumerate(raw[law]):totals[4*law+j]+=a*sum(v[c] for c in word[:t])
            totals[8+2*law]+=a;totals[9+2*law]+=a*t
        totals[-1]-=m*(2 if l==2 else 1)
        if l!=2:
            assert t<=cert['nominalThrough'];rhs+=m*sign*sum(mu[c] for c in word[:t])
    assert totals==[0]*12+[-1] and rhs==-F(cert['lower'])
assert [F(c['lower']) for c in r['certificates']]==[F(4,25),F(14,87)]`;
  const run=spawnSync('python3',['-c',py],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
});

test('online readings preserve every observed prefix as the controller changes later commands', () => {
  const r=suffixFirstReceiver(source,packet);
  assert.deepEqual(r.verify(),{histograms:6435, orderedTails:16777216, pairs:195, splitHistograms:57,
    reorderedLowerBounds:['4/25','14/87']});
  for (const tail of [Array(8).fill('ref'),source.catalog.commands,[...source.catalog.commands].reverse(),
                      ['ref','ref','z0','ref','y1','group','x0','ref']]) {
    const word=[...opening,...tail],full=r.receive(word);
    for (let n=0;n<=16;n++) assert.deepEqual(r.receive(word.slice(0,n)).readings,full.readings.slice(0,n+1));
    assert.equal(full.worlds.length,2);
  }
  const bad=structuredClone(packet.reordered);
  bad.certificates[1].weights[0][1]++;
  assert.throws(()=>checkReordering(source.catalog,bad),/cancel/);
  assert.throws(()=>r.receive(['x0']),/opening/);
  const cli=spawnSync(process.execPath,['scripts/sixteen-pulse-suffix-first.mjs','--verify'],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout),r.verify());
});
