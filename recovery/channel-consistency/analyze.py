import json,math,bisect
from pathlib import Path
root=Path(__file__).resolve().parent;source=root.parent/'joint-measured'
train=json.loads((source/'training-runs.json').read_text());held=json.loads((source/'held-runs.json').read_text())
# Prescribed kinematic windows; supplied rate only, never differentiated angle.
def constraints(run,offset=0):
 rows=run['samples'];ts=[r['time']for r in rows];assert all(abs((b-a)-.01)<1e-9 for a,b in zip(ts,ts[1:]))
 def rate(t):
  k=bisect.bisect_right(ts,t)-1
  if k<0 or k>=len(ts)-1:return None
  f=(t-ts[k])/(ts[k+1]-ts[k]);return rows[k]['rate']*(1-f)+rows[k+1]['rate']*f
 out=[]
 for start in range(10,len(rows)-50,10):
  end=start+40;a=ts[start]+offset;b=ts[end]+offset
  if a<ts[0] or b>=ts[-1]:continue
  knots=[a]+[t for t in ts if a<t<b]+[b]
  integral=sum((rate(x)+rate(y))*(y-x)/2 for x,y in zip(knots,knots[1:]))
  out.append((integral,ts[end]-ts[start],rows[end]['position']-rows[start]['position']))
 return out

def fit(cs):
 aa=sum(a*a for a,b,y in cs);ab=sum(a*b for a,b,y in cs);bb=sum(b*b for a,b,y in cs);ay=sum(a*y for a,b,y in cs);by=sum(b*y for a,b,y in cs);det=aa*bb-ab*ab
 return [(ay*bb-by*ab)/det,(by*aa-ay*ab)/det]
def score(cs,g=1,bias=0):
 es=[g*a+bias*b-y for a,b,y in cs];return {'count':len(es),'rmseRad':math.sqrt(sum(e*e for e in es)/len(es)),'maxAbsRad':max(map(abs,es))}
rows=[]
for shift in range(-5,6):
 offset=shift*.01;cs=sum([constraints(r,offset)for r in train],[]);g,b=fit(cs);rows.append({'rateTimeOffsetSeconds':offset,'gain':g,'biasRadPerSecond':b,'original':score(cs),'affineTraining':score(cs,g,b),'originalHeld':score(constraints(held[0],offset)),'affineHeld':score(constraints(held[0],offset),g,b)})
best=min(rows,key=lambda r:r['affineTraining']['rmseRad']);result={'meaning':'Exploratory kinematic consistency, not law fitting or independent sensor calibration. Original angle increments vs integral of supplied rate over fixed0.4second windows every0.1s; linear interpolation only for explicit offset hypotheses. Shared affine rate and finite offset chosen on two original trainingcourses; consumed heldcourse reported separately. No source or model changed; no differentiation of angle.','rows':rows,'trainingSelected':best}
(root/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps({'zeroOffset':rows[5],'trainingSelected':best},indent=2))
