"""Weak magnetic-work and calorimetric functionals from the Levinsky source archive."""
import bisect
import csv
import hashlib
import io
import itertools
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile

ARCHIVE = 'e12c9d0b23f14ecf7cc78ea2039b3db6b32e8cfb4541b1b21b62a6a09ae7a8cb'
ANCHORS = (0., .5, 1.5, 5., 7.)
HELD = (1., 2., 3.)
WINDOWS = tuple((a, a+15) for a in (5, 11))
BASELINES = ('nearest', 'linear', 'linear2', 'pchip', 'pchip2', 'nominal_m', 'fixed')
def encode(value):
    return json.dumps(value, allow_nan=False, sort_keys=True, separators=(',', ':')).encode()
def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(2**20), b''):h.update(b)
    return h.hexdigest()
def sealed(path):
    if digest(path)!=ARCHIVE:raise ValueError('source archive identity')
    return ZipFile(path)
def source_rows(archive,name):
    with archive.open(name) as fp:
        stream=io.TextIOWrapper(fp,encoding='latin-1',newline='')
        for line in stream:
            if line.strip()=='[Data]':break
        else:raise ValueError(name+' missing table')
        yield from csv.DictReader(stream)
def merge_points(points):
    grouped=defaultdict(list)
    for x,y in points:
        if not(math.isfinite(x) and math.isfinite(y)):raise ValueError('nonfinite input')
        grouped[x].append(y)
    return sorted((x,statistics.mean(yy)) for x,yy in grouped.items())
def linear(points,x):
    a,b=points[0][0],points[-1][0]
    if not a<=x<=b:raise ValueError(('outside measured support',x,a,b))
    idx=bisect.bisect_left(points,(x,-math.inf))
    if idx<len(points) and points[idx][0]==x:return points[idx][1]
    left,right=points[idx-1],points[idx]
    return left[1]+(right[1]-left[1])*(x-left[0])/(right[0]-left[0])
def phi(T,win):
    u=(T-win[0])/(win[1]-win[0])
    return 16*u*u*(1-u)**2 if 0<=u<=1 else 0.
def weighted_heat(points,win):
    a,b=win
    knots=[a]+[x for x,y in points if a<x<b]+[b]
    vals=[linear(points,x) for x in knots]
    out=[]
    for l,r,yl,yr in zip(knots,knots[1:],vals,vals[1:]):
        for s,w in ((-math.sqrt(.6),5/9),(0.,8/9),(math.sqrt(.6),5/9)):
            u=(s+1)/2;t=l+u*(r-l)
            out.append((r-l)/2*w*phi(t,win)*(yl+u*(yr-yl)))
    return math.fsum(out)
def heat_panels(z,fields):
    result={};raw={}
    for h in fields:
        token=(str(int(h)) if h.is_integer() else str(h).replace('.','p'))+'T'
        markers=(token+'.dat',token+'_2nd.dat',token+'_3rd.dat')
        files=[n for n in z.namelist() if '/Heat capacity - raw' in n and 'addenda' not in n.lower() and n.endswith(markers) and ('_'+token+'.dat' in n or '_'+token+'_' in n)]
        assert len(files)==(3 if h==0 else 1),(h,files)
        vec=[]
        for n in files:
            records=list(source_rows(z,n))
            # Use only measured temperatures bracketing the two registered windows.
            coords=sorted({float(r['Sample Temp (Kelvin)']) for r in records if r['Sample Temp (Kelvin)'] and r['Field (Oersted)']})
            lower=max(v for v in coords if v<=5.);upper=min(v for v in coords if v>=26.)
            pts=[];fields_here=[];missing=0
            for row in records:
                names=[k for k in row if k and k.startswith('Samp HC (')]
                T=row['Sample Temp (Kelvin)'];H=row['Field (Oersted)'];C=row[names[0]]
                if not(T and H and C):missing+=1;continue
                t=float(T)
                if not lower<=t<=upper:continue
                bh=float(H)/10000
                assert abs(bh-h)<.001,(bh,h)
                pts.append((t,float(C)/3.585/t));fields_here.append(bh)
            pts=merge_points(pts)
            v=[weighted_heat(pts,win) for win in WINDOWS]
            vec.append(v);raw[Path(n).name]={'field':h,'rows':len(pts),'missing':missing,'field_range':[min(fields_here),max(fields_here)],'ct_points':pts,'weak':v}
        result[h]=[statistics.mean(xs) for xs in zip(*vec)]
    return result,raw
def branch_work(points,fields):
    pts=merge_points(points)
    out={}
    for h in fields:
        if h==0:out[h]=0.;continue
        knots=[0.]+[b for b,m in pts if 0.<b<h]+[h]
        assert max(r-l for l,r in zip(knots,knots[1:]))<.08,(h,'sweep gap')
        vals=[linear(pts,b) for b in knots]
        out[h]=math.fsum((r-l)*(m+n)/2 for l,r,m,n in zip(knots,knots[1:],vals,vals[1:]))
    return out
def magnet(z):
    match=[n for n in z.namelist() if '/MH - raw data and origin - figure S11/' in n and n.endswith('.dat')]
    if len(match)!=1:raise ValueError('ambiguous sample')
    blocks=[]
    for row in source_rows(z,match[0]):
        t=round(float(row['Temperature (K)']))
        if not blocks or blocks[-1][0]!=t:blocks.append((t,[]))
        blocks[-1][1].append((float(row['Magnetic Field (Oe)'])/10000,row['Moment (emu)']))
    temps=list(range(50,1,-3));inds=[i for i in range(len(blocks)-len(temps)+1) if [b[0] for b in blocks[i:i+len(temps)]]==temps]
    if len(inds)!=1:raise ValueError('ambiguous cooling sequence')
    fields=sorted(ANCHORS+HELD);work={}
    for t,rr in blocks[inds[0]:inds[0]+len(temps)]:
        if t<5 or t>26:continue
        top=max(range(len(rr)),key=lambda k:rr[k][0])
        branches=(rr[:top+1],rr[top:])
        ws=[]
        for branch in branches:
            pts=[(b,float(v)*.001/(2.865e-6)) for b,v in branch if v.strip()]
            ws.append(branch_work(pts,fields))
        work[t]={k:v for k,v in zip(('up','down'),ws)}
    xs={k:{} for k in ('up','down','mean')}; ts=sorted(work)
    for h in fields:
        for branch in ('up','down'):
            v=[work[t][branch][h] for t in ts]
            slope=[(b-a)/(r-l) for a,b,l,r in zip(v,v[1:],ts,ts[1:])]
            xs[branch][h]=[math.fsum(phi(t,win)*(b-a) for t,a,b in zip(ts[1:-1],slope,slope[1:])) for win in WINDOWS]
        xs['mean'][h]=[(a+b)/2 for a,b in zip(xs['up'][h],xs['down'][h])]
    return xs,work
def cubic(points,x):
    """Shape-preserving cubic Hermite interpolation (PCHIP), incl. one-sided endpoints."""
    xx,yy=zip(*points);dx=[b-a for a,b in zip(xx,xx[1:])]
    ds=[(b-a)/d for a,b,d in zip(yy,yy[1:],dx)]
    def edge(h0,h1,s0,s1):
        v=((2*h0+h1)*s0-h0*s1)/(h0+h1)
        if v*s0<=0:return 0.
        return 3*s0 if s0*s1<0 and abs(v)>3*abs(s0) else v
    deriv=[edge(dx[0],dx[1],ds[0],ds[1])]
    for i in range(1,len(xx)-1):
        a,b=ds[i-1],ds[i];l,r=dx[i-1],dx[i]
        w1,w2=2*r+l,r+2*l
        deriv.append((w1+w2)/(w1/a+w2/b) if a*b>0 else 0.)
    deriv.append(edge(dx[-1],dx[-2],ds[-1],ds[-2]))
    i=min(len(xx)-2,max(0,bisect.bisect_right(xx,x)-1));u=(x-xx[i])/dx[i]
    if not 0<=u<=1:raise ValueError('outside cubic support')
    return (1+2*u)*(1-u)**2*yy[i]+u*(1-u)**2*dx[i]*deriv[i]+u*u*(3-2*u)*yy[i+1]+u*u*(u-1)*dx[i]*deriv[i+1]
def heat_ref(tab,fields,h,j,method):
    if method=='nearest':return tab[min(fields,key=lambda a:(abs(a-h),a))][j]
    f=(lambda a:a*a) if method.endswith('2') else (lambda a:a)
    pts=[(f(a),tab[a][j]) for a in fields]
    return (cubic if method.startswith('pchip') else linear)(pts,f(h))
def calibrate(y,x):
    pairs=[]
    for h in ANCHORS[1:-1]:
        other=[b for b in ANCHORS if b!=h]
        for j in range(len(WINDOWS)):
            pairs.append((x[h][j]-heat_ref(x,other,h,j,'linear'),y[h][j]-heat_ref(y,other,h,j,'linear')))
    xx=math.fsum(u*u for u,v in pairs)
    if xx==0:raise ValueError('calibration curvature has zero rank')
    return max(0.,math.fsum(u*v for u,v in pairs)/xx),pairs
def train(z):
    y0,raw=heat_panels(z,ANCHORS)
    y={h:[v-base for v,base in zip(vv,y0[0.])] for h,vv in y0.items()}
    xs,work=magnet(z)
    estimates={br:calibrate(y,x) for br,x in xs.items()}
    forecasts=[]
    for h in HELD:
        for j,win in enumerate(WINDOWS):
            pred={name:heat_ref(y,ANCHORS,h,j,name) for name in BASELINES[:5]}
            pred['nominal_m']=xs['mean'][h][j]
            for br,x in xs.items():
                corr=x[h][j]-heat_ref(x,ANCHORS,h,j,'linear')
                pred[br]=pred['linear']+estimates[br][0]*corr
                if br=='mean':pred['fixed']=pred['linear']+corr
            forecasts.append({'h':h,'window':win,'j':j,'forecasts':pred})
    return {'rows':forecasts,'anchors':y,'raw_calibration':raw,'M_work':work,'weak_M':xs,'fit':estimates,'baseline0':y0[0.]}
def program(path,out,mode,expected=None):
    out.mkdir(parents=True,exist_ok=True)
    with sealed(path) as z:
        if mode=='train':
            packet=train(z)
            f=out/'predictions.json'
            with f.open('xb') as fp:fp.write(encode(packet))
            print('LOCK',f,digest(f),flush=True)
            print('SUMMARY',json.dumps({'scales':{k:v[0] for k,v in packet['fit'].items()},'rows':len(packet['rows'])}),flush=True)
            return
        f=out/'predictions.json';assert digest(f)==expected
        pk=json.loads(f.read_bytes());test,raw=heat_panels(z,HELD);scored=[]
        for row in pk['rows']:
            h,j=row['h'],row['j'];scored.append({**row,'target':test[h][j]-pk['baseline0'][j]})
        rms={};by={};wst={}
        for name in scored[0]['forecasts']:
            es=[[r['forecasts'][name]-r['target'] for r in scored if r['h']==h] for h in HELD]
            by[name]=[math.sqrt(statistics.mean(e*e for e in vv)) for vv in es]
            rms[name]=math.sqrt(statistics.mean(v*v for v in by[name]));wst[name]=max(abs(e) for vv in es for e in vv)
        best=min(BASELINES,key=rms.get)
        gates={'coverage':len(scored)==6,'gain':rms['mean']<=.95*rms[best],
               'field_wins':all(a<b for a,b in zip(by['mean'],by[best])),'worst':wst['mean']<=1.05*wst[best]}
        rep={'lock':expected,'rows':scored,'raw_test':raw,'rms':rms,'field_rms':by,'worst':wst,'best':best,'gates':gates}
        (out/'score.json').write_bytes(encode(rep))
        print('SCORE',digest(out/'score.json'),json.dumps({k:rep[k] for k in ('rms','field_rms','worst','best','gates')}),flush=True)
        print('WORST',json.dumps(max(scored,key=lambda r:abs(r['forecasts']['mean']-r['target']))))
if __name__=='__main__':
    import sys
    program(Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3],sys.argv[4] if len(sys.argv)>4 else None)
