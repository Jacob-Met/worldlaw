import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('raw vertices certify all six early branches across all ordered continuations', () => {
  const code = `import base64,itertools,json,math
from fractions import Fraction as Q
from pathlib import Path
cat=json.loads(Path('examples/active-position-drift-sixteen-pulse-upper.json').read_text())['catalog']
packet=json.loads(Path('examples/sixteen-pulse-early-worlds.json').read_text())
cmd=cat['commands'];vertices=[l['vertices'] for l in cat['laws']]
mu=[sum(Q(w,12)*v[j] for law,weights in zip(vertices,([1,2,1,2],[2,1,2,1])) for w,v in zip(weights,law)) for j in range(8)]
tails=list(itertools.combinations_with_replacement(range(8),7));assert len(tails)==3432
branches=packet['branches'];assert set(branches)==set(cmd[2:])
cases=pairs=0
for c in range(2,8):
    b=branches[cmd[c]];delta=Q(b['shift']);assert delta==(-Q(1,174) if cmd[c][0]=='x' else 0)
    ids=base64.b64decode(b['assignments'],validate=True);assert len(ids)==len(tails) and set(ids)==set(range(len(b['pairs'])))
    states=[]
    for den,*n in b['pairs']:
        assert den>0 and len(n)==10 and den%174==0 and den%12==0
        half=14*den//87;nom=[int(q*den) for q in mu];worlds=[]
        for l in range(2):
            w=n[3*l:3*l+3];w.append(den-sum(w));assert min(w)>=0
            origin,drift=n[6+2*l:8+2*l]
            r=[drift+sum(m*v[j] for m,v in zip(w,vertices[l])) for j in range(8)]
            assert all(abs(origin+t*r[0])<=half for t in range(9))
            p=origin+8*r[0]+r[c];error=p-nom[c]-int(delta*den)
            worlds.append((p,r,error,[a-b for a,b in zip(r,nom)]))
        states.append((half,worlds));pairs+=1
    for ix,tail in enumerate(tails):
        e,worlds=states[ids[ix]];term=[]
        for pos,inc,base,residual in worlds:
            # Excluding each possible final command reduces the remaining six to
            # the unrestricted subset box. This independent enumeration checks
            # every intermediate order while keeping the final observation free.
            dr=[residual[j] for j in tail]
            for end in set(dr):
                rest=dr.copy();rest.remove(end)
                assert base+sum(min(0,d) for d in rest)>=-e
                assert base+sum(max(0,d) for d in rest)<=e
            term.append(pos+sum(inc[j] for j in tail))
        assert abs(term[0]-term[1])<=2*e
        cases+=1
assert (cases,pairs)==(20592,776)`;
  const result=spawnSync('python3',['-c',code],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});

test('the public H16 receiver uses only past actions and preserves source order and physical tubes', () => {
  const code=`import importlib.util,json,sys,random
from pathlib import Path
from fractions import Fraction as Q
sys.path.insert(0,'scripts')
sp=importlib.util.spec_from_file_location('near','scripts/near-balanced-even-obstruction.py')
m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
src=json.loads(Path('examples/active-position-drift-sixteen-pulse-upper.json').read_text())
src['catalog']['laws'].reverse()
for law in src['catalog']['laws']:law['vertices'].reverse()
src['catalog']['noiseBound']='14/87'
ex=m.Experiment(src,early_bound=True);assert ex.describe()['atRequestedNoise']=='closed-collision'
assert m.Experiment(src,terminal_bound=True).describe()['adaptiveUpper']=='5/31'
assert ex.e==Q(14,87)<Q(5,31)
names=m.NAMES;rng=random.Random(168870)
def receive(tape):
    runs=[dict(command=c,repeats='1') for c in tape];p=ex.receive(runs);reading=[Q(v['reading']) for v in p['measurements']]
    assert len(reading)==len(tape)+1
    for world in p['worlds']:
        law=next(l for l in src['catalog']['laws'] if l['id']==world['law'])
        w=list(map(Q,world['weights']));assert min(w)>=0 and sum(w)==1
        y=Q(world['origin']);drift=Q(world['drift']);assert abs(y-reading[0])<=ex.e
        for i,c in enumerate(tape):
            y+=drift+sum(a*v[names.index(c)] for a,v in zip(w,law['vertices']))
            assert abs(y-reading[i+1])<=ex.e
    return reading
for c in names[2:]:
    for tail in [list(names[:7]),list(reversed(names[:7])),[c]*7]:
        tape=['ref']*8+[c]+tail;history=receive(tape)
        assert history[9]==ex.mu[c]+(-Q(1,174) if c[0]=='x' else 0)
        for t in range(17):assert receive(tape[:t])==history[:t+1]
for n in (7,8,9):
    for direction in (0,1):
        for i in range(36):
            # Every placement of a sole group in a baseline block is exercised.
            b=['ref']*n;b[i%n]='group'
            s=[rng.choice(names[2:]) for _ in range(16-n)]
            receive((s+b) if direction else (b+s))
for i in range(100):receive([rng.choice(names) for _ in range(16)])
`;
  const result=spawnSync('python3',['-c',code],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});
