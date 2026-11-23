"""Qualify t/B/dBdt only. Never decode H, including for intermediate calculations."""
import json,sys,pathlib,re,zipfile
import numpy as np
N=32768
GRID=np.arange(N)/N

def read_inputs(root,ring,run):
    with zipfile.ZipFile(pathlib.Path(root)/("Ring%d_Dataset_Txt.zip"%ring)) as z:
        info=z.getinfo(run["path"])
        if (info.file_size,format(info.CRC,"08x"))!=(run["size"],run["crc"]): raise ValueError("member identity")
        with z.open(info) as stream:
            header=re.split(r"[,\s]+",stream.readline().decode("utf-8-sig").strip())
            if header!=["t_s","B_T","H_Aperm","dBdt_Tpers"]:
                raise ValueError(("unexpected header before any numeric rows",run["path"],header))
            indices=[header.index(k) for k in ["t_s","B_T","dBdt_Tpers"]]
            rows=[]
            for raw in stream:
                if not raw.strip(): continue
                fields=re.split(rb"[,\s]+",raw.strip())
                if len(fields)!=4:raise ValueError("row shape")
                rows.append([float(fields[i]) for i in indices])
    t,b,d=np.array(rows,dtype=float).T
    if not np.isfinite([t,b,d]).all() or not np.all(np.diff(t)>0):raise ValueError("finite positive clock")
    p=(t-t[0])*run["f"]
    dp=np.median(np.diff(p))
    if min(abs(p[-1]-1),abs(p[-1]+dp-1))>1.5*dp:raise ValueError(("one-period clock",run["path"],p[-1],dp))
    if abs(p[-1]-1)<.5*dp:p,b,d=p[:-1],b[:-1],d[:-1]
    if p[-1]>=1:raise ValueError("repeated period")
    bgrid=np.interp(GRID,p,b,period=1)
    harmonic=np.mean(bgrid*np.exp(-2j*np.pi*GRID))
    if abs(harmonic)<=0:raise ValueError("no fundamental")
    offset=-np.angle(harmonic)/(2*np.pi)
    bgrid=np.interp((GRID+offset)%1,p,b,period=1)
    return bgrid,dict(samples=len(t),start=t[0],end=t[-1],phase_of_fundamental_max=float(offset),fundamental_amplitude=2*abs(harmonic),rate_min=float(d.min()),rate_max=float(d.max()))

def turns(b,height):
    n=len(b); k=int(np.argmin(b)); x=np.tile(np.roll(b,-k),3)
    out=[]; rising=True; ext=0
    for i in range(1,len(x)):
        if rising:
            if x[i]>x[ext]:ext=i
            if x[ext]-x[i]>=height:
                out.append((ext,1)); rising=False;ext=i
        else:
            if x[i]<x[ext]:ext=i
            if x[i]-x[ext]>=height:
                out.append((ext,-1)); rising=True;ext=i
    return sorted((((i+k)%n,s,float(x[i])) for i,s in out if n<=i<2*n))

def compare(source,target,gs,gt,mf,amp):
    maxima=(float(np.max(np.abs(source-target))),int(np.argmax(np.abs(source-target))))
    mapped=[]
    for i,s,val in gs:
        choices=[(min((i-j)%N,(j-i)%N),h) for h,(j,ss,_) in enumerate(gt) if s==ss]
        if not choices:continue
        ds,h=min(choices);j,_,tval=gt[h]
        small=min(abs(tval-gt[(h-1)%len(gt)][2]),abs(tval-gt[(h+1)%len(gt)][2]))
        mapped.append(dict(source_index=i,target_index=j,slot=h,source_B_T=val,target_B_T=tval,time_in_carrier_periods=mf*ds/N,relative_to_smaller_target_swing=(abs(val-tval)/small if small>0 else None)))
    slots=[m["slot"] for m in mapped]
    bijective=len(gs)==len(gt)==len(set(slots))==len(mapped) and len(slots)>0
    cyclic=bijective and all((slots[(i+1)%len(slots)]-slot)%len(slots)==1 for i,slot in enumerate(slots))
    worstphase=max(mapped,key=lambda m:m["time_in_carrier_periods"],default=None)
    worstlevel=max((m for m in mapped if m["relative_to_smaller_target_swing"] is not None),key=lambda m:m["relative_to_smaller_target_swing"],default=None)
    ok=bool(maxima[0]<=.005*amp and cyclic and worstphase and worstphase["time_in_carrier_periods"]<=.1 and worstlevel and all(m["relative_to_smaller_target_swing"] is not None for m in mapped) and worstlevel["relative_to_smaller_target_swing"]<=.1)
    return dict(pass_pair=ok,source_turns=len(gs),target_turns=len(gt),unique_matches=len(set(slots)),cyclic=cyclic,max_abs_B_diff_T=maxima[0],worst_grid_index=maxima[1],worst_source_B_T=float(source[maxima[1]]),worst_target_B_T=float(target[maxima[1]]),worst_phase=worstphase,worst_level=worstlevel)

def main(root):
    reg=json.load(open("pwm_registration.json"));results=[]
    for g in reg["groups"]:
        traces=[];metadata=[]
        for run in g["runs"]:
            b,m=read_inputs(root,g["ring"],run)
            traces.append(b);metadata.append(m)
        gs=[turns(b,.05*g["amplitude"]/g["mf"]) for b in traces]
        pairs=[dict(source_frequency=run["f"],target_frequency=g["runs"][-1]["f"],**compare(b,traces[-1],gr,gs[-1],g["mf"],g["amplitude"])) for b,gr,run in zip(traces[:-1],gs[:-1],g["runs"][:-1])]
        results.append(dict(group=g["key"],runs=metadata,pairs=pairs,accepted=all(r["pass_pair"] for r in pairs)))
    print(json.dumps(dict(groups=results,accepted=all(g["accepted"] for g in results),H_decoded=False),sort_keys=True,allow_nan=False))
if __name__=="__main__":main(sys.argv[1])
