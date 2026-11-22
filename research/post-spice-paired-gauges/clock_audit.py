"""Audit actual missing-minute flag symbols and cross-season clock support."""
from collections import Counter
from datetime import datetime
import json
import hashlib
from pathlib import Path
import sys
from urllib.request import Request,urlopen

def read(site,yr,doi):
    source='https://doi.pangaea.de/10.1594/PANGAEA.'+str(doi)+'?format=textfile&charset=UTF-8'
    with urlopen(Request(source,headers={'User-Agent':'Post-SPICE source clock and flag audit'}),timeout=45) as r:
        for line in r:
            if line.strip().endswith(b'*/'):break
        else:raise ValueError('Incomplete publisher metadata')
        hdr=r.readline().decode().rstrip().split('\t');ref=next(n for n in ['R2G','R2P'] if f'Precip [mm] ({n})' in hdr);type_=ref[-1]
        roles=[ref,'R3A'+type_,'R3U'+type_]
        raw=[hdr.index('Precip [mm] ('+n+')') for n in roles]; flags=[hdr.index('Missing [#] ('+n+')') for n in roles]
        wx=hdr.index('ff [m/s] (at gauge height)');wt=hdr.index('Missing [#] (Wind_gh)');tx=next(i for i,c in enumerate(hdr) if c.startswith('TTT'));tt=hdr.index('Missing [#] (Tair)')
        names=[];presence=set();alltimes=set();tokens=[Counter() for _ in roles];patterns=Counter();seasons=Counter();dateoutside=[];full=set()
        for row in r:
            c=row.rstrip(b'\n\r').split(b'\t');stamp=c[0].decode();dt=datetime.fromisoformat(stamp);assert stamp not in alltimes;alltimes.add(stamp)
            seasons[stamp[:7]]+=1
            if not (datetime(2014+yr,8,1)<=dt<datetime(2015+yr,8,1)):dateoutside.append(stamp)
            if not all(c[i].strip() for i in raw):continue
            presence.add(stamp);fs=[c[i].decode('ascii') for i in flags]
            for i,v in enumerate(fs):tokens[i][v]+=1
            patterns[tuple(fs)]+=1
            if all(v in ['0','0.0'] for v in fs) and c[wt] in [b'0',b'0.0'] and c[tt] in [b'0',b'0.0'] and c[wx] and c[tx]:full.add(stamp)
        return {'alltimes':alltimes,'presence':presence,'full':full,'summary':dict(site=site,yr=yr,months=seasons,odd_date_n=len(dateoutside),odd_date_span=[min(dateoutside),max(dateoutside)] if dateoutside else [],tokens_by_role={n:c.most_common(12) for n,c in zip(roles,tokens)},top_flag_tuples=patterns.most_common(10))}
def main():
    output={}
    for site,pair in [('XBK',(907362,907363)),('MAR',(907373,907374))]:
        a,b=[read(site,j+1,d) for j,d in enumerate(pair)];sets={}
        for field in ['alltimes','presence','full']:
            both=sorted(a[field]&b[field]);sets[field]=dict(n=len(both),first=both[:4],last=both[-4:])
        output[site]={'chronology':[a['summary'],b['summary']],'cross_season_clock_overlap':sets};print('QUALIFICATION',site,json.dumps(output[site]),flush=True)
    path=Path(sys.argv[1])/'flag-clock-audit.json';path.write_text(json.dumps(output,indent=2)+'\n');print('COMPLETE',hashlib.sha256(path.read_bytes()).hexdigest(),path)
if __name__=='__main__':main()
