"""Independent exact-binary-rational enclosure review; no production arithmetic reused."""
import fractions, json, pathlib, random, subprocess
F = fractions.Fraction
rng = random.Random(10796)
cases = []
values = [0.0, -0.0, 5e-324, -5e-324, 1e-300, -1e-300,
          0.1, -0.1, 1e6, -1e6, 999999.9999999999, 2**-53]
radii = [0, 5e-324, 1e-300, 1e-16, 0.1, 1e6]
for i in range(600):
    rows = []
    for x,y in [(0,0),(1,0),(0,1),(1,1)]:
        value = rng.choice(values) if i < 300 else rng.uniform(-1e6,1e6)
        for repeat in range(1 + rng.randrange(3)):
            delta = rng.choice([0, 5e-324, 1e-16, .1]) if repeat else 0
            rows.append(dict(command=x,position=y,rate=0,jointTorque=min(1e6,value+delta)))
    cases.append(dict(rows=rows,declaration=dict(axes=['command','position'],fixedValue=0,
                      torqueRadius=rng.choice(radii),exactCoordinates=True)))
script="""import {inspectSeparability} from './src/science/separability.mjs';
let text='';for await(const part of process.stdin)text+=part;
console.log(JSON.stringify(JSON.parse(text).map(c=>inspectSeparability(c.rows,c.declaration))));"""
ran=subprocess.run(['node','--input-type=module','-e',script],input=json.dumps(cases),capture_output=True,text=True,check=True)
screens=json.loads(ran.stdout)
contrasts=conflicts=excluded=0
for case,screen in zip(cases,screens):
    bounds={}
    for state in screen['states']:
        source=[case['rows'][i]['jointTorque'] for i in state['rowIndices']]
        radius=F(case['declaration']['torqueRadius'])
        lo=max(F(v)-radius for v in source);hi=min(F(v)+radius for v in source)
        bounds[state['id']]=(lo,hi)
        got=state['torqueInterval']
        assert F(got[0])<=lo and F(got[1])>=hi
        if state['status']=='incompatible-replicates':assert lo>hi;conflicts+=1
    assert len(screen['rectangles'])==1
    r=screen['rectangles'][0];boxes=[bounds[i] for i in r['corners']]
    if any(lo>hi for lo,hi in boxes):continue
    lo=boxes[0][0]-boxes[1][1]-boxes[2][1]+boxes[3][0]
    hi=boxes[0][1]-boxes[1][0]-boxes[2][0]+boxes[3][1]
    got=r['contrastInterval'];assert got is not None
    assert F(got[0])<=lo and F(got[1])>=hi
    if r['status']=='additivity-excluded':assert lo>0 or hi<0;excluded+=1
    contrasts+=1
print(json.dumps({'cases':len(cases),'enclosed_nonempty_contrasts':contrasts,
                  'sound_replicate_conflicts':conflicts,'sound_exclusions':excluded,
                  'oracle':'Python Fraction of exact binary64 input values, independent extrema'},indent=2))
