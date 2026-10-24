import json
from fractions import Fraction as F
from pathlib import Path
cases=json.loads(Path(__file__).with_name('interaction-oracle-cases.json').read_text());checks=0
for c in cases:
 u,p=F(c['row']['command']),F(c['row']['position']);ru,rp=F(c['r']['command']),F(c['r']['position']);a,b,d=[F(t['coefficient']) for t in c['terms']]
 for uf in [-1,F(-1,2),0,F(1,2),1]:
  for pf in [-1,F(-1,2),0,F(1,2),1]:
   x,y=u+uf*ru,p+pf*rp;exact=a*x*y+b*y+d*y**3
   for lo,hi in c['results']:
    assert F(lo)<=exact<=F(hi),(c,x,y,exact,lo,hi)
    checks+=1
print(f'{checks} exact-rational polynomial point enclosures across500 signed/cross-zero/zero-radius boxes and5 refinement settings passed')
