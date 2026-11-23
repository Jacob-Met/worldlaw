"""Independent fixed-width RINEX development recap; no forecasting module imports."""
import argparse
from collections import defaultdict
import gzip
import hashlib
import json
import math
from pathlib import Path
import zipfile

DIRS = ('WUT000POL','WUT100POL')
SOURCE_HASH=('b5fb7116ba01ec2fcef9f7163bb6ad26eb691dec40085b719db04618378feb87',
             'fff1a8da7c268ca6742ea6ccb9f582bf44344b9b14a667114527e84c3cecade6')
FREQ=(1575420000,1176450000,1207140000)
def read_site(root,site,hh):
    prefix=DIRS[site]+'_R_2024068'
    ticks={}
    values=defaultdict(dict)
    with zipfile.ZipFile(root/(prefix+'.zip')) as z:
        with z.open(f'{prefix}/{prefix}{hh:02d}00_01H_01S_MO.rnx') as f:
            for row in f:
                if b'END OF HEADER' in row[60:]:
                    break
            t,flag=None,None
            for row in f:
                if row[:1]==b'>':
                    y,mo,day,h,m,s,flag=row[1:].split()[:7]
                    assert (int(y),int(mo),int(day),int(h))==(2024,3,8,hh)
                    assert float(s).is_integer()
                    t=int(m)*60+int(float(s))
                    flag=int(flag)
                    ticks.setdefault(t,[]).append(flag)
                elif row[:1]==b'E' and row[1:3].isdigit() and flag in [0,1]:
                    sat=row[:3].decode()
                    assert t not in values[sat]
                    item=[]
                    for pos in (19,147,211):
                        cycles=float(row[pos:pos+14].strip() or 0)
                        bit=int(row[pos+14:pos+15].strip() or 0)
                        item.append([cycles if cycles and math.isfinite(cycles) else None,bit])
                    values[sat][t]=item
    result={}
    window=None
    for m in range(59):
        rr=range(60*m,60*m+61)
        for sat,obs in values.items():
            present=[t for t in rr if t in obs]
            if not present: continue
            fields={}
            for j,code in enumerate(('L1C','L5Q','L7Q')):
                pair=[obs[t][j][0] if t in obs else None for t in (rr[0],rr[-1])]
                val=None if None in pair else (pair[1]-pair[0])*(299792458/FREQ[j])
                fields[code]=[val,sum(obs[t][j][0] is not None for t in present),sum(bool(obs[t][j][1]) for t in present)]
            result[m,sat]=[all(ticks.get(t)==[0] for t in rr),fields]
            if (hh,m,sat)==(12,8,'E36'):
                window=[[t,ticks.get(t),obs.get(t)] for t in rr]
    return result,window

def run(root,bank,score):
    for site,name in enumerate(DIRS):
        with (root/(name+'_R_2024068.zip')).open('rb') as f:
            h=hashlib.sha256()
            for chunk in iter(lambda:f.read(1048576),b''): h.update(chunk)
        assert h.hexdigest()==SOURCE_HASH[site]
    b=json.loads(gzip.decompress(bank.read_bytes()))
    s=json.loads(gzip.decompress(score.read_bytes()))
    bankrows={tuple(k):raw for k,raw,pred in b['rows']}
    ledger={tuple(k):cells for k,cells in b['donor_roster']}
    outcome={tuple(k):cells for k,cells,y in s['raw_targets']}
    count=eligible=components=0
    trace=[]
    for h in range(12,18):
        sites=[]
        for i in range(2):
            site,win=read_site(root,i,h)
            sites.append(site)
            if win: trace.append(win)
        for m,sat in set(sites[0])|set(sites[1]):
            key=(h,m,sat)
            count+=1
            donor_ok=True
            for i,site in enumerate(sites):
                x=site.get((m,sat))
                held=ledger[key][i]
                if x is None:
                    assert held is None
                    donor_ok=False
                    continue
                assert held[0]==x[0]
                for code in ('L1C','L5Q'):
                    assert x[1][code]==held[1][code]
                    components+=1
                donor_ok=donor_ok and x[0] and all(x[1][c][1:]==[61,0] for c in ('L1C','L5Q'))
            assert donor_ok==(key in bankrows)
            if donor_ok:
                eligible+=1
                for i,site in enumerate(sites):
                    x=site[m,sat]
                    assert [x[1][c][0] for c in ('L1C','L5Q')]==bankrows[key][i]
                    assert [x[0],{'L7Q':x[1]['L7Q']}]==outcome[key][i]
                    components+=1
    assert count==len(ledger) and eligible==len(bankrows)==len(outcome) and len(trace)==2
    return dict(seen_satellite_windows=count,eligible=eligible,source_component_records=components,
                worst_key=[12,8,'E36'],worst_window_columns=['second_of_hour','epoch_flags',
                        'L1C,L5Q,L7Q each [cycles,LLI]'],worst_original_window=trace)
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for k in ('root','forecast','score'):parser.add_argument(k,type=Path)
    args=parser.parse_args()
    print(json.dumps(run(args.root,args.forecast,args.score),sort_keys=True))
