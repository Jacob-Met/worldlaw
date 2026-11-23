"""Independent lexical availability recount with exact release bytes and per-channel classes."""
import datetime as dt,hashlib,json,os,re,sys,urllib.request,urllib.parse
from pathlib import Path
base=Path(__file__).resolve().parent;mask=json.loads((base/'eligibility.json').read_bytes())
# A numeric measurement is never converted, summarized, printed, or passed to fitting.
F={b'99999.99',b'99999.00',b'99999.0',b'99999',b'88888.88',b'88888.00',b'88888.0',b'88888',b'-99999.99',b'-99999.00',b'-99999',b'NaN',b'nan',b'null'}
def main():
    dates=mask['dates'];details={};actual=[]
    for day in dates:
        details[day]={}
        for role,elements in [('B','X,Y'),('E','E-N,E-E')]:
            ref=dates[day][role];args=dict(id='BOU',elements=elements,type='variation',format='iaga2002',sampling_period=1,starttime=day+'T00:00:00Z',endtime=day+'T23:59:59Z')
            url='https://geomag.usgs.gov/ws/data/?'+urllib.parse.urlencode(args)
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Earth-observatory-independent-mask-recount/1.0'}),timeout=110) as f:b=f.read(40000001)
            assert len(b)==ref['bytes'] and hashlib.sha256(b).hexdigest()==ref['sha256']
            data=b.split(b'\nDATE ')[1].split(b'\n',1)[1].splitlines()
            data=[r for r in data if r.strip()]
            assert len(data)==86400
            beg=dt.datetime.fromisoformat(day);bad=[set(),set()];tokens=[{},{}]
            for i,line in enumerate(data):
                parts=line.split()
                expect=(beg+dt.timedelta(seconds=i)).strftime('%Y-%m-%d %H:%M:%S').encode()
                assert b' '.join(parts[:2]).split(b'.')[0]==expect
                for k in range(2):
                    val=parts[3+k]
                    if val in F:
                        bad[k].add(i);v=val.decode();tokens[k][v]=tokens[k].get(v,0)+1
            miss=bad[0]|bad[1];complete=[i for i in range(21) if not any(k//4096==i for k in miss)]
            assert len(miss)==ref['missing_rows'] and complete==ref['valid_windows']
            details[day][role]={'missing_individual':[len(a) for a in bad],'both_missing':len(bad[0]&bad[1]),'token_counts':tokens,'complete':complete}
        e=sorted(set(details[day]['B']['complete']).intersection(details[day]['E']['complete']))
        assert e==dates[day]['eligible'];actual.append(len(e))
        print('RECOUNT',day,len(e),flush=True)
    ok=min(actual)>=12
    assert ok==mask['qualified']==False
    print('INDEPENDENT',json.dumps({'days':details,'qualified':ok,'utc_rows':14*86400,'electrode_or_magnetic_values_decoded':0,'source_spectra_evaluated':0,'mask_sha256':hashlib.sha256((base/'eligibility.json').read_bytes()).hexdigest()},sort_keys=True,separators=(',',':')))
if __name__=='__main__':main()
