"""Independent held-direction line parser and Brier recount. Uses no course modules."""
from collections import defaultdict
import argparse
import hashlib
import json
import math
from pathlib import Path,PurePosixPath
import re
import zipfile
import numpy as np

ARMS=('prior','state16','state64','state256','recent16','recent64','recent256','history64','shuffled64')
H=(2,4,8,16,32,64,128)
ARCHIVE_SHA='2db6f26e29a5d8967d133dee2fa109d58b67e1a28a068bd00fd1f04bd9e4e402'
def filehash(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        while a:=f.read(1048576):h.update(a)
    return h.hexdigest()

def split_blocks(raw):
    starts=[i for i,l in enumerate(raw) if b'Transition' in l]
    for a,b in zip(starts,starts[1:]+[len(raw)]):
        yield raw[a],[l for l in raw[a+1:b] if l.strip()]

def scores(raw,dt,expected):
    # Establish the first sampled midpoint after observing the source-side region.
    deadline=max(0,300-math.ceil(128/dt-1e-12))
    visited=False;cross=False;last=-1;num=0
    for j,val in enumerate(raw[:deadline+1]):
        num+=1
        if not math.isfinite(val):
            if np.isfinite(expected[0]):raise ValueError("Issued invalid prefix")
            return None,None
        if val<=.2:visited=True;last=j
        if visited and val>=.5:
            cross=True;break
    i=num-1;now=raw[i];lag=max(1,math.ceil(8/dt-1e-12));slow=max(1,math.ceil(32/dt-1e-12))
    u=[now,i/300,int(cross),int(visited),now-raw[max(0,i-lag)],(i-last)*dt if visited else 0.,
       now-math.fsum(raw[max(0,i-slow+1):i+1])/min(i+1,slow)]
    if not np.allclose(u,expected,rtol=0,atol=2e-12):
        raise ValueError(("Archived prefix",u,expected))
    for j in range(i,min(301,i+math.floor(128/dt+1e-12)+1)):
        if not math.isfinite(raw[j]):return None,None
        if raw[j]>=.8:
            time=(j-i)*dt
            return np.asarray([int(time<=h+1e-10) for h in H]),(i,j)
    return np.zeros(7,dtype=np.int8),(i,None)

def run(archive,bank,primary):
    if filehash(archive)!=ARCHIVE_SHA or filehash(bank)!=primary['prediction_sha256']:
        raise ValueError("Input identity")
    ref={tuple(r['key']):r for r in primary['rows']}
    seen=set();ids=defaultdict(list);sums=defaultdict(lambda:np.zeros(len(ARMS)))
    horizons=defaultdict(lambda:np.zeros((9,7)))
    observed=defaultdict(int);unknown=defaultdict(int);timeout=defaultdict(int)
    worst=(float('-inf'),None);case_count=0
    with zipfile.ZipFile(archive) as z,np.load(bank) as b:
        files=set(z.namelist());keys={tuple(json.loads(s)):i for i,s in enumerate(b['keys'])}
        for path in sorted(x for x in files if PurePosixPath(x).name.startswith('Data Info Folding')):
            pp=PurePosixPath(path);group=pp.parent.name
            for line in z.read(path).decode('latin1').splitlines()[1:]:
                if not line.strip():continue
                name,dt,a,c,n=line.split('\t')
                dt=float(dt)*1e6;a=float(a);c=float(c);key=(group,dt,a,c)
                num=keys[key];member=str(pp.parent/name)
                if member not in files:
                    unknown[key]+=int(n);continue
                ppred=b[f'{num}_p'];xx=b[f'{num}_x']
                framed=list(split_blocks(z.read(member).splitlines()))
                if not framed:unknown[key]+=int(n)
                for block,(head,lines) in enumerate(framed):
                    signature=(key,head,hashlib.sha256(b'\n'.join(lines)).hexdigest())
                    if signature in seen:continue
                    seen.add(signature)
                    matrix=[l.split(b'\t') for l in lines]
                    columns=head.decode('latin1').rstrip('\t').split('\t')
                    for col,tag in enumerate(columns):
                        counter=len(ids[key]);id_=f'{member}:{block}:{col}:{tag}';ids[key].append(id_)
                        if len(lines)!=301 or not re.fullmatch('DownTransition[0-9]+',tag):
                            unknown[key]+=1;continue
                        vals=[]
                        for row in matrix:
                            try:val=float(row[col])
                            except (ValueError,IndexError):val=math.nan
                            vals.append((val-a)/(c-a))
                        y,indices=scores(vals,dt,xx[counter])
                        if y is None:
                            unknown[key]+=1;continue
                        p=ppred[counter];sq=(p-y[None,:])**2
                        if np.any(np.diff(p,axis=1)<-1e-12) or np.any(p<0) or np.any(p>1):
                            raise ValueError("Invalid CDF")
                        means=sq.mean(axis=1);sums[key]+=means;horizons[key]+=sq
                        observed[key]+=1;case_count+=1
                        timeout[key]+=int(xx[counter,2]==0)
                        if group.startswith('Hairpin ') and means[7]>worst[0]:
                            i,j=indices
                            worst=(means[7],dict(id=id_,key=key,issue_sample=i,first_passage_sample=j,recorded_prefix=vals[:i+1],
                               trace_q=[v if math.isfinite(v) else None for v in vals],actual_events=y.tolist(),forecasts=p.tolist()))
        for key,i in keys.items():
            digest=hashlib.sha256(('\n'.join(ids[key])+'\n').encode()).hexdigest()
            if digest!=str(b[f'{i}_ids_hash']):raise ValueError(("Original column identity",key))
    worst_delta=0.
    for k,r in ref.items():
        if observed[k]!=r['observed'] or unknown[k]!=r['unknown'] or timeout[k]!=r['observed_timeout']:
            raise ValueError(("Raw cohort",k,observed[k],unknown[k],timeout[k],r))
        worst_delta=max(worst_delta,float(np.max(np.abs(sums[k]-r['arm_sum']))))
    if worst_delta>2e-7:raise ValueError(("Brier sum tolerance",worst_delta))
    groups={}
    for group in sorted(k[0] for k in ref):
        if group in groups:continue
        ks=[k for k in ref if k[0]==group]
        seenkeys=[k for k in ks if observed[k]]
        groups[group]=np.mean([sums[k]/observed[k] for k in seenkeys],axis=0)
        if not np.allclose(groups[group],primary['cohorts'][group]['point'],atol=1e-10,rtol=0):
            raise ValueError(("Equal-stratum average",group))
        for sign,field in ((0,'declared_lower'),(1,'declared_upper')):
            envelope=np.mean([(sums[k]+sign*unknown[k])/(observed[k]+unknown[k]) for k in ks],axis=0)
            if not np.allclose(envelope,primary['cohorts'][group][field],atol=1e-10,rtol=0):
                raise ValueError(("Unobserved column bound",group,sign))
    physical=np.asarray([v for k,v in groups.items() if k.startswith('Hairpin ')])
    avg=physical.mean(axis=0);top=physical.max(axis=0)
    gates={'mean_beats_all_six':bool(avg[7]<min(avg[1:7])),'worst_beats_all_six':bool(top[7]<min(top[1:7])),
       'mean_beats_shuffled':bool(avg[7]<avg[8]),'worst_beats_shuffled':bool(top[7]<top[8])}
    if gates!=primary['gates'] or all(gates.values())!=primary['joint'] or abs(worst[0]-primary['raw_worst']['loss'])>1e-12:
        raise ValueError("Registered outcome")
    return {"observed_paths":case_count,"issued_probability_components":case_count*len(H)*len(ARMS),
        "group_count":len(ref),"raw_worst":worst[1],"max_group_sum_delta":worst_delta,
        "gates":gates,"joint":all(gates.values()),"unknown_paths_count_conditional":sum(unknown.values())}

if __name__=='__main__':
    p=argparse.ArgumentParser()
    for name in ('archive','bank','score','result'):p.add_argument(name,type=Path)
    a=p.parse_args();out=run(a.archive,a.bank,json.loads(a.score.read_text()))
    a.result.write_text(json.dumps(out,sort_keys=True,separators=(',',':'),allow_nan=False)+'\n')
    print('RECOUNT',json.dumps({k:v for k,v in out.items() if k!='raw_worst'},sort_keys=True))
