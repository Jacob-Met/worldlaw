from pathlib import Path
from fractions import Fraction as F
import json,subprocess,random,hashlib,os
assert os.environ.get('BASELINE_SEPARABILITY_MODULE'),'Set BASELINE_SEPARABILITY_MODULE to the frozen pre-extraction separability.mjs'
root=Path(__file__).resolve().parents[1];rng=random.Random(119742);cases=[]
axes_all=[['command','position'],['position','rate'],['rate','command'],['position','command']]
for i in range(320):
 axes=axes_all[i%4];fixed=next(k for k in ['command','position','rate'] if k not in axes);radius=[0,0.125,2**-1074,1e-200][i%4];rows=[]
 for x in range(4):
  for y in range(4):
   if rng.random()<.55:
    row={axes[0]:x,axes[1]:y,fixed:0,'jointTorque':rng.choice([-1,1])*rng.random()*(1e-200 if i%4==3 else 5)};rows.append(row)
 if rows and i%3==0:rows.append({**rows[0],'jointTorque':rows[0]['jointTorque']+(1 if i%2 else 0)})
 rows.append({axes[0]:99,axes[1]:99,fixed:1,'jointTorque':1e6})
 cases.append({'rows':rows,'declaration':{'axes':axes,'fixedValue':0,'torqueRadius':radius,'exactCoordinates':True}})
js="import fs from 'node:fs';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {inspectSparseAdditivity} from './src/science/additive-graph.mjs';import {inspectSeparability as current} from './src/science/separability.mjs';const {inspectSeparability:old}=await import(pathToFileURL(process.env.BASELINE_SEPARABILITY_MODULE));const cases=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(cases.map(c=>{assert.deepEqual(current(c.rows,c.declaration),old(c.rows,c.declaration));return inspectSparseAdditivity(c.rows,c.declaration)})));"
proc=subprocess.run(['node','--input-type=module','-e',js],cwd=root,input=json.dumps(cases),text=True,capture_output=True,check=False);assert proc.returncode==0,proc.stderr;results=json.loads(proc.stdout);counts={}
def unpack(x):return F(int(x['integer']))*F(2)**x['powerOfTwo']
for c,r in zip(cases,results):
 status=r['status'];counts[status]=counts.get(status,0)+1;axes=c['declaration']['axes'];fixed=next(k for k in ['command','position','rate'] if k not in axes);radius=F(c['declaration']['torqueRadius']);rows=c['rows']
 if status=='compatible-on-observed-slice':
  potentials={(x['axis'],x['value']):unpack(x['valueExact']) for x in r['potentials']}
  for row in rows:
   if row[fixed]!=0:continue
   value=sum(potentials[(axis,row[axis])] for axis in axes);assert abs(value-F(row['jointTorque']))<=radius
 elif status=='additivity-excluded':
  balance={};total=F(0)
  for edge in r['witness']['edges']:
   row=rows[edge['row']];assert row[fixed]==0;assert edge['sign'] in [-1,1]
   for axis in axes:key=(axis,row[axis]);balance[key]=balance.get(key,0)+edge['sign']
   total+=edge['sign']*F(row['jointTorque'])+radius
  assert all(v==0 for v in balance.values());assert total<0;assert total==unpack(r['witness']['upperBound'])
 elif status=='incompatible-replicates':
  a,b=(rows[k] for k in r['conflict']['rows']);assert all(a[k]==b[k] for k in axes+[fixed]);assert F(a['jointTorque'])-radius>F(b['jointTorque'])+radius
 else:raise AssertionError(status)
receipt={'status':'ACCEPT integrated mathematical mechanism and preserved rectangle behavior','cases':len(cases),'counts':counts,'hashes':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['src/science/additive-source.mjs','src/science/separability.mjs','src/science/additive-graph.mjs']},'whole_rectangle_result_parity':len(cases),'coverage':'Exact Fraction certificate checks,4ordered-axis pairs,subnormal/very-small radii,original-row replicate conflicts,off-slice exclusion. Scope is sampled coordinate feasibility, not physical identification.'}
(root/'independent-review/additive-graph-review.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
