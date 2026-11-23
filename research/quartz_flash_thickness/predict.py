"""Lock every source-only forecast. The HT2 input is the signed file/clock roster only."""
import base64,zlib
from model import *
def main():
    roster_bytes=(ROOT/'roster.json').read_bytes();p=read_json('protocol.json')
    assert sha(roster_bytes)==p['roster_sha256']
    roster=json.loads(roster_bytes);assert len(roster)==18
    arr=[];meta=[]; cache={}
    with archive() as a:
        pt,pw,pc=pulse(a)
        for row in roster:
            paths=tuple(q['sha256'] for q in row['source'])
            key=(paths,row['target']['thickness_mm'])
            if key not in cache:
                source=normal(np.mean([waveform(a,x,'HT1')[0] for x in row['source']],axis=0))
                cache[key]=predict(source,row['source'][0]['thickness_mm'],row['target']['thickness_mm'],pt,pw)
            y,m=cache[key];arr.append(y)
            meta.append(dict(target=row['target']['sha256'],sources=paths,parameters=m))
    arr=np.asarray(arr,dtype='<f8');assert arr.shape==(18,9,801) and np.isfinite(arr).all()
    raw=arr.tobytes();out=dict(shape=arr.shape,dtype='<f8',sha256=sha(raw),bytes=len(raw),role_digests=[[sha(x.tobytes()) for x in t] for t in arr],pulse=pc,fit=meta,source_configurations=len(cache),target_voltages_read=0,roster=sha(roster_bytes),protocol=sha((ROOT/'protocol.json').read_bytes()))
    print('FORECAST',json.dumps(out,separators=(',',':')),flush=True)
    print('FORECAST_Z85',base64.b85encode(zlib.compress(raw,9)).decode(),flush=True)
if __name__=='__main__':main()
