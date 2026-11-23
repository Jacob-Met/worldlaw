"""Independent archive receiver for the two-window Levinsky test; standard library only."""
import argparse
from collections import defaultdict
import csv
import hashlib
from io import TextIOWrapper
import json
import math
from pathlib import Path
from statistics import mean
from zipfile import ZipFile

ARCHIVE='e12c9d0b23f14ecf7cc78ea2039b3db6b32e8cfb4541b1b21b62a6a09ae7a8cb'
LOCK='ee8c92010b178b45d509511a733db5f9fa870030ef2edd198d3c85b354283936'
SCORE='3955f02819d9506298ec85b782a249f744878937bb44c78c1033abc1ab3c69cb'
A=[0,.5,1.5,5,7]
H=[1,2,3]
WINDOW=[(5,20),(11,26)]
def sha(path):
    with path.open('rb') as fp:return hashlib.file_digest(fp,'sha256').hexdigest()
def close(x,y,tol=2e-10):
    if abs(x-y)>tol*max(1,abs(y)):raise ValueError((x,y))
def rows(z,name):
    with z.open(name) as fp:
        text=TextIOWrapper(fp,encoding='latin1',newline='')
        for line in text:
            if line.strip()=='[Data]':break
        yield from csv.DictReader(text)
def segment(points,x):
    for (a,l),(b,r) in zip(points,points[1:]):
        if a<=x<=b:return l+(r-l)*(x-a)/(b-a)
    raise ValueError(('uncovered',x))
def merged(pairs):
    groups=defaultdict(list)
    for x,y in pairs:groups[x].append(y)
    return sorted((x,mean(v)) for x,v in groups.items())
def mag_work(field,pts):
    # Integrate each native segment after clipping both endpoints.
    out=[]
    for (a,l),(b,r) in zip(pts,pts[1:]):
        x=max(a,0.);y=min(b,field)
        if y<=x:continue
        m=(r-l)/(b-a)
        out.append((y-x)*(l+m*((x+y)/2-a)))
    return math.fsum(out)
def d2_weight(T,a,b):
    u=(T-a)/(b-a)
    return 16*(2-12*u+12*u*u)/(b-a)**2
def m_panel(z):
    fname=next(n for n in z.namelist() if '/MH - raw data and origin - figure S11/' in n and n.endswith('.dat'))
    blocks=[]
    for rr in rows(z,fname):
        t=round(float(rr['Temperature (K)']))
        if not blocks or blocks[-1][0]!=t:blocks.append((t,[]))
        blocks[-1][1].append((float(rr['Magnetic Field (Oe)'])*1e-4,rr['Moment (emu)']))
    seq=[t for t,rr in blocks];begin=seq.index(50)
    assert seq[begin:begin+17]==list(range(50,1,-3))
    fields=sorted(A+H)
    allwork=defaultdict(dict)
    for t,rr in blocks[begin:begin+17]:
        if not 5<=t<=26:continue
        peak=max(range(len(rr)),key=lambda i:rr[i][0])
        for branch,x in zip(('up','down'),(rr[:peak+1],rr[peak:])):
            pts=merged((b,float(m)*1000/2.865) for b,m in x if m)
            assert pts[0][0]<=0 and pts[-1][0]>=7
            assert all(min(r[0],7)-max(l[0],0)<.08 for l,r in zip(pts,pts[1:]))
            for field in fields:allwork[branch].setdefault(field,[]).append((t,mag_work(field,pts)))
    weak=defaultdict(dict)
    for br,ff in allwork.items():
        for field,tt in ff.items():
            p=sorted(tt);ans=[]
            for a,b in WINDOW:
                pieces=[]
                for (t0,y0),(t1,y1) in zip(p,p[1:]):
                    if t0<a or t1>b:continue
                    for v in (-1/math.sqrt(3),1/math.sqrt(3)):
                        u=(1+v)/2;t=t0+u*(t1-t0)
                        pieces.append((t1-t0)/2*d2_weight(t,a,b)*(y0+u*(y1-y0)))
                ans.append(math.fsum(pieces))
            weak[br][field]=ans
    for h in fields:weak['mean'][h]=[mean(k) for k in zip(weak['up'][h],weak['down'][h])]
    return weak
def hc_integral(pts,a,b):
    # Integrate quartic weight times the linear C/T interpolant analytically
    # in the local variable v=(T-L)/(R-L), avoiding long-power differences.
    width=b-a
    result=[]
    for (x0,f0),(x1,f1) in zip(pts,pts[1:]):
        l=max(x0,a);r=min(x1,b)
        if r<=l:continue
        L=(l-a)/width;d=(r-l)/width
        c=[0.]*5
        for n,coef in ((2,16.),(3,-32.),(4,16.)):
            for j in range(n+1):c[j]+=coef*math.comb(n,j)*L**(n-j)*d**j
        fl=f0+(f1-f0)*(l-x0)/(x1-x0)
        delta=(f1-f0)*(r-l)/(x1-x0)
        result.append((r-l)*sum(coef*(fl/(j+1)+delta/(j+2)) for j,coef in enumerate(c)))
    return math.fsum(result)
def heat(z):
    panel={}
    suffix={0:['0T','0T_2nd','0T_3rd'],.5:['0p5T'],1:['1T'],1.5:['1p5T'],2:['2T'],3:['3T'],5:['5T'],7:['7T']}
    for h,identifiers in suffix.items():
        yy=[]
        for tag in identifiers:
            files=[n for n in z.namelist() if '/Heat capacity - raw' in n and 'addenda' not in n.lower() and n.endswith('_'+tag+'.dat')]
            assert len(files)==1
            rr=[r for r in rows(z,files[0]) if r['Sample Temp (Kelvin)'] and r['Field (Oersted)']]
            tt=[float(r['Sample Temp (Kelvin)']) for r in rr];lo=max(t for t in tt if t<=5);hi=min(t for t in tt if t>=26)
            ckey=next(k for k in rr[0] if k.startswith('Samp HC ('))
            pts=merged((t,float(r[ckey])/(3.585*t)) for t,r in zip(tt,rr) if lo<=t<=hi and r[ckey])
            yy.append([hc_integral(pts,l,b) for l,b in WINDOW])
        panel[h]=[mean(c) for c in zip(*yy)]
    return {h:[v-u for v,u in zip(row,panel[0])] for h,row in panel.items()}
def piece(tab,fs,h,j):
    return segment([(k,tab[k][j]) for k in fs],h)
def cubic(fs,ys,h):
    # Standard PCHIP weighted harmonic derivative in divided-difference form.
    slopes=[(yr-yl)/(xr-xl) for xl,xr,yl,yr in zip(fs,fs[1:],ys,ys[1:])]
    step=[b-a for a,b in zip(fs,fs[1:])]
    def boundary(l,r,first,second):
        v=first+(first-second)*l/(l+r)
        if first*v<=0:return 0
        if first*second<0 and abs(v)>3*abs(first):return 3*first
        return v
    der=[boundary(*step[:2],*slopes[:2])]
    for i in range(1,len(fs)-1):
        q0,q1=slopes[i-1:i+1]
        p=(2*step[i]+step[i-1])/(3*(step[i-1]+step[i]))
        der.append(1/(p/q0+(1-p)/q1) if q0*q1>0 else 0)
    der.append(boundary(step[-1],step[-2],slopes[-1],slopes[-2]))
    i=next(i for i in range(len(fs)-1) if fs[i]<=h<=fs[i+1])
    a=fs[i];u=(h-a)/step[i];q=slopes[i]
    return ys[i]+(h-a)*(der[i]+u*(3*q-2*der[i]-der[i+1]+u*(der[i]+der[i+1]-2*q)))
def receive(archive,forecast,score):
    assert (sha(archive),sha(forecast),sha(score))==(ARCHIVE,LOCK,SCORE)
    pk=json.loads(forecast.read_bytes());rep=json.loads(score.read_bytes())
    with ZipFile(archive) as z:X=m_panel(z);Y=heat(z)
    params={}
    for br,x in X.items():
        pairs=[]
        for h in A[1:-1]:
            att=[k for k in A if k!=h]
            for j in range(2):
                pairs.append((x[h][j]-piece(x,att,h,j),Y[h][j]-piece(Y,att,h,j)))
        params[br]=max(0,sum(a*b for a,b in pairs)/sum(a*a for a,b in pairs))
        close(params[br],pk['fit'][br][0])
        for h,vals in x.items():
            for j,v in enumerate(vals):close(v,pk['weak_M'][br][str(float(h))][j])
    errs=defaultdict(lambda:defaultdict(list));mx=0
    for raw,target in zip(pk['rows'],rep['rows']):
        h=raw['h'];j=raw['j'];y=Y[h][j];close(y,target['target'])
        preds={'nearest':Y[min(A,key=lambda k:abs(k-h))][j],
               'linear':piece(Y,A,h,j),'nominal_m':X['mean'][h][j]}
        for name,sq in (('pchip',False),('pchip2',True),('linear2',True)):
            fs=[v*v if sq else v for v in A];xx=h*h if sq else h;ys=[Y[i][j] for i in A]
            preds[name]=cubic(fs,ys,xx) if name.startswith('pchip') else segment(list(zip(fs,ys)),xx)
        for br,x in X.items():
            dq=x[h][j]-piece(x,A,h,j);preds[br]=preds['linear']+params[br]*dq
            if br=='mean':preds['fixed']=preds['linear']+dq
        for name,v in preds.items():
            close(v,raw['forecasts'][name]);close(v,target['forecasts'][name])
            errs[name][h].append(v-y);mx=max(mx,abs(v-target['forecasts'][name]))
    rms={};field={};worst={}
    for name,table in errs.items():
        field[name]=[math.sqrt(mean(e*e for e in table[h])) for h in H]
        rms[name]=math.sqrt(mean(e*e for e in field[name]))
        worst[name]=max(abs(e) for v in table.values() for e in v)
        close(rms[name],rep['rms'][name]);close(worst[name],rep['worst'][name])
        for a,b in zip(field[name],rep['field_rms'][name]):close(a,b)
    best=min(('fixed','nearest','linear','linear2','pchip','pchip2','nominal_m'),key=rms.get)
    gates={'coverage':len(rep['rows'])==6,'gain':rms['mean']<=.95*rms[best],'field_wins':all(a<b for a,b in zip(field['mean'],field[best])),'worst':worst['mean']<=1.05*worst[best]}
    assert gates==rep['gates'] and best==rep['best']
    return dict(raw_cohort='same-lineage agglomerate',moments=48,forecasts=60,calorimetric_targets=6,maximum_prediction_difference=mx,scales=params,gates=gates)
if __name__=='__main__':
    cli=argparse.ArgumentParser()
    for key in ('archive','forecast','score'):cli.add_argument(key,type=Path)
    args=cli.parse_args();print(json.dumps(receive(args.archive,args.forecast,args.score),sort_keys=True))
