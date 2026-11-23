"""Decode only the permitted cell/channel and source-clock ranges in each assigned split."""
import csv,io,json,math,re,zipfile
from itertools import groupby
from pathlib import PurePosixPath

ROSTER={'train':('A1',{10,30,50,70,90}),'development':('A2',{20,60}),
        'reserve_same':('A3',{40,80}),'reserve_other':('B',{40,80})}


def decode(archive_path, stage, endpoints):
    cell,allowed=ROSTER[stage]
    data=[];fail=[];seen=set()
    with zipfile.ZipFile(archive_path) as archive:
        for member in sorted(archive.namelist()):
            path=PurePosixPath(member)
            if path.parent.name!='EHC_full_cell_pristine':continue
            m=re.fullmatch(r'SoC(\d+)_(cha|dch)\.csv',path.name)
            if not m or int(m[1]) not in allowed:continue
            soc,approach=int(m[1]),m[2];seen.add((soc,approach))
            with archive.open(member) as bf, io.TextIOWrapper(bf,encoding='utf-8-sig',newline='') as stream:
                line=stream.readline();delim=max((';',',','\t'),key=line.count);col=next(csv.reader([line],delimiter=delim))
                ts,ix=map(col.index,('t_s','Step'));vc,tc,amb=map(col.index,(f'V_{cell}_V',f'T_{cell}_degC','Tamb_degC'))
                rows=csv.reader(stream,delimiter=delim)
                for step,group in groupby(rows,lambda rr:int(rr[ix])):
                    if step==0:continue
                    init=None;bins=[[] for _ in range(12)];terminal=[]
                    for raw in group:
                        t=float(raw[ts]);init=t if init is None else init;t-=init
                        if 0<=t<=21600:
                            i=min(11,int(t//1800));bins[i].append((t,float(raw[vc])*1000,float(raw[tc]),float(raw[amb])))
                        elif endpoints and 41400<=t<=43200:
                            terminal.append((t,float(raw[vc])*1000))
                    # Numeric outputs never influence clock support. Each interval must have at
                    # least 20 minute-spaced samples, endpoints within 150s, and gaps <=150s.
                    def covered(points,low,high):
                        ts2=[r[0] for r in points]
                        return len(ts2)>=20 and ts2[0]-low<=150 and high-ts2[-1]<=150 and all(b-a<=150 for a,b in zip(ts2,ts2[1:]))
                    key={'cell':cell,'soc':soc,'approach':approach,'ordinal':step//2}
                    bad=[j for j,g in enumerate(bins) if not covered(g,j*1800,(j+1)*1800)]
                    if endpoints and not covered(terminal,41400,43200):bad.append('endpoint')
                    if bad:fail.append({**key,'missing_bins':bad});continue
                    vals=[[sum(a[j] for a in g)/len(g) for g in bins] for j in range(4)]
                    assert all(math.isfinite(v) for vv in vals for v in vv),(cell,soc,step,'nonfinite source field')
                    row={**key,'hours':[v/3600 for v in vals[0]],'voltage_mV':vals[1],'surface_C':vals[2],'ambient_C':vals[3],
                         'bin_counts':[len(i) for i in bins]}
                    if endpoints:
                        assert all(math.isfinite(v) for _,v in terminal)
                        row.update(endpoint_mV=sum(v for _,v in terminal)/len(terminal),endpoint_samples=len(terminal),
                                   endpoint_mean_time_h=sum(t for t,_ in terminal)/len(terminal)/3600)
                    data.append(row)
    assert seen=={(s,a) for s in allowed for a in ('cha','dch')}
    assert len(data)+len(fail)==40*len(allowed),(len(data),len(fail))
    return data,fail
