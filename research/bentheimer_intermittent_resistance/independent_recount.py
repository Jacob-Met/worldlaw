"""Rebuild stage forecasts and pressure comparisons with independent Decimal arithmetic."""
import hashlib
import itertools
import json
from decimal import Decimal as D, getcontext
from pathlib import Path

getcontext().prec = 55
Z, ONE, HUNDRED = D(0), D(1), D(100)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def half(token):
    return D(1).scaleb(D(token).as_tuple().exponent)/2

def y(o,w):
    return 1 / (D('.830')*(o/D('.838')+w/D('.822')))

def moments(vertices,m):
    vals=[]
    for (x,a),(z,b) in itertools.combinations(vertices,2):
        if x<=m<=z:
            vals.append((a*(z-m)+b*(m-x))/(z-x))
    vals.extend(v for x,v in vertices if x==m)
    if not vals: raise ValueError("infeasible moment")
    return min(vals),max(vals)

def recount(root,identities):
    for fn,expected in identities.items():
        if sha(root/fn)!=expected:
            raise ValueError("substituted file: "+fn)
    source=json.loads((root/'low-rate-calibration.json').read_text())['low_source_only']
    lock=json.loads((root/'forecast-lock.json').read_text(),parse_float=D)
    score=json.loads((root/'score.json').read_text(),parse_float=D)
    low1=[list(map(D,r)) for r in source['Table 1']]
    low2=[list(map(D,r)) for r in source['Table 2']]
    measured=[(r[1],y(r[2],r[3])) for r in low2]
    poly=[(Z,measured[0][1]),*measured,(ONE,measured[-1][1])]
    def value(x):
        for (a,v),(b,w) in zip(poly,poly[1:]):
            if a<=x<=b:
                return ((b-x)*v+(x-a)*w)/(b-a)
        raise ValueError('domain')
    def interval(lo,m,hi):
        pts={lo,hi}
        pts.update(k for k,_ in measured if lo<k<hi)
        return moments([(x,value(x)) for x in sorted(pts)],m)
    def avg(i):
        return sum(i)/D(len(i))
    def bounds(t):
        return max(Z,D(t['water'])-half(t['water'])),min(ONE,1-(D(t['oil'])-half(t['oil'])))
    stages=[D(x) for x in ('0','.15','.3','.5','.7','.85','1')]
    high=lock['high_imaging_inputs']
    if len(high)!=7 or [r[0] for r in low1]!=stages or [r[0] for r in low2]!=stages:
        raise ValueError('stage membership')
    tolerance=D('2e-10')
    diff=[]
    def same(a,b):
        delta=abs(a-D(b))
        if delta>tolerance: raise ValueError(f'difference {a} versus {b}')
        diff.append(delta)
    every=[]; errors={};covered=0;widths=[];refwidths=[]
    for j,f in enumerate(stages):
        t=high[j];l=lock['predictions'][j];s=score['rows'][j]
        if D(t['fw'])!=f or l['fw']!=f or s['fw']!=f: raise ValueError('alignment')
        m=D(t['Sw']);lo,hi=bounds(t);low=low2[j];sl=low[1];r0=measured[j][1]
        same(m,l['high_Sw']); same(lo,l['support'][0]);same(hi,l['support'][1])
        rr=interval(lo,m,hi);full=interval(Z,m,ONE)
        for a,b in zip(rr,l['R_interval']):same(a,b)
        for a,b in zip(full,l['full_support_interval']):same(a,b)
        donor=(j%5)+1 if 1<=j<=5 else j
        dl,dh=bounds(high[donor]);dm=D(high[donor]['Sw'])
        vals={'occupancy-midpoint':avg(rr),'mean-saturation':value(m),'same-flow-fraction':r0,
              'endpoint-switch':avg(moments([(lo,value(lo)),(hi,value(hi))],m)) if lo!=hi else value(lo),
              'full-support-midpoint':avg(full),'cyclic-support':avg(interval(max(Z,m-dm+dl),m,min(ONE,m-dm+dh)))}
        for role,frac,key in [('connected-stable',D(t['oil']),'conn_stable'),('connected-permissive',D(t['oil'])+D(t['intermittent']),'conn_union')]:
            conductance=f*m/sl
            if f<1:
                conductance+=(1-f)*frac*D(t[key])/((1-sl)*low1[j][2])
            if conductance<=0:
                if not isinstance(l['values'][role],dict):raise ValueError('unregistered infinite output')
                continue
            vals[role]=r0/conductance
        _,sm,ot,wt=s['target_printed']
        if D(sm)!=m:raise ValueError('physical target alignment')
        o,w=D(ot),D(wt);truth=y(o,w);same(truth,s['target'])
        do,dw=(Z if f==1 else half(ot)),(Z if f==0 else half(wt))
        rounded=[y(o+do,w+dw),y(max(Z,o-do),max(Z,w-dw))]
        for a,b in zip(rounded,s['printing_interval']):same(a,b)
        pi=D('3.14159265358979323846264338327950288419716939937510')
        kpa_scale=D('.5e-6')/60*D('.000830')*D('.060')/(pi*D('.00499')**2/4*D('2.045e-12'))/1000
        same(truth*kpa_scale,s['kPa'])
        for role,p in vals.items():
            same(p,l['values'][role]);same(p-truth,s['signed_errors'][role])
            if 1<=j<=5:errors.setdefault(role,[]).append(abs(p-truth))
        every.append(len(vals))
        if 1<=j<=5:
            covered+=int(rr[0]<=truth<=rr[1]); widths.append(rr[1]-rr[0]);refwidths.append(full[1]-full[0])
    for role,err in errors.items():
        if len(err)==5:
            same(avg(err),score['metrics'][role]['mae']);same(max(err),score['metrics'][role]['maxae'])
    same(avg(widths),score['mean_width']);same(avg(refwidths),score['mean_full_width'])
    point=errors['occupancy-midpoint']
    strict=all(len(v)==5 and avg(point)<avg(v) and max(point)<max(v) for k,v in errors.items() if k!='occupancy-midpoint')
    gate=len(errors)==8 and strict and covered>=4 and avg(widths)<avg(refwidths)
    if covered!=score['covered'] or gate!=score['pass_primary']:raise ValueError('decision mismatch')
    return {'source_digits':55,'actual_stage_count':7,'finite_forecasts_each':every,'decimal_checks':len(diff),
            'maximum_absolute_delta':str(max(diff)),'conditional_interval_contains':covered,
            'pass_primary':gate,'inputs_sha256':identities}

if __name__=='__main__':
    import sys
    root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent
    if len(sys.argv)>2:
        import xml.dom.minidom as md
        raw=Path(sys.argv[2]); report=json.loads((root/'score.json').read_bytes())
        if sha(raw)!=report['xml_sha256']: raise ValueError('physical source digest')
        doc=md.parse(str(raw))
        texts=lambda element: ''.join(n.data for n in element.childNodes if n.nodeType==n.TEXT_NODE).strip()
        tables=[x for x in doc.getElementsByTagName('table-wrap') if texts(x.getElementsByTagName('label')[0])=='Table 2']
        if len(tables)!=1:raise ValueError('target table')
        rawrows=[]
        for row in tables[0].getElementsByTagName('tbody')[0].getElementsByTagName('tr'):
            c=[texts(x) for x in row.getElementsByTagName('td')]
            if len(c)!=7:raise ValueError('target row')
            rawrows.append([c[0],*c[4:]])
        if rawrows != [r['target_printed'] for r in report['rows']]:raise ValueError('published physical values disagree')
    identities=json.loads((root/'recount-inputs.json').read_text())
    print(json.dumps(recount(root,identities),indent=2))
