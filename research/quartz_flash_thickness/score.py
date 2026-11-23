"""Open target voltages only after all forecast bytes and each arm have been verified."""
import base64,zlib
from model import *
def main():
    p=read_json('protocol.json');lock=read_json('forecast-lock.json')
    roster_bytes=(ROOT/'roster.json').read_bytes();roster=json.loads(roster_bytes);assert sha(roster_bytes)==p['roster_sha256']==lock['roster']
    assert sha((ROOT/'protocol.json').read_bytes())==lock['protocol']
    b=zlib.decompress(base64.b85decode((ROOT/'forecasts.b85').read_bytes().strip()))
    assert sha(b)==lock['sha256'] and len(b)==lock['bytes']==18*9*801*8 and lock['shape']==[18,9,801] and lock['target_voltages_read']==0
    pred=np.frombuffer(b,dtype='<f8').reshape(18,9,801)
    assert np.isfinite(pred).all() and [[sha(x.tobytes()) for x in t] for t in pred]==lock['role_digests']
    assert [r['target'] for r in lock['fit']]==[r['target']['sha256'] for r in roster] and [r['sources'] for r in lock['fit']]==[[s['sha256'] for s in r['source']] for r in roster]
    targets=[];raw=[];base=[]
    with measurements() as a:
        for row in roster:
            y,v,z=waveform(a,row['target'],'HT2');targets.append(y);raw.append(v);base.append(z)
    d=pred-np.array(targets)[:,None,:];per=np.sqrt(np.mean(d*d,axis=2))
    grouped=per.reshape(6,3,9).mean(axis=1);avg=grouped.mean(axis=0)
    winner=(grouped[:,0,None]<grouped[:,1:]).all(axis=1)
    w=np.unravel_index(np.argmax(np.abs(d[:,0])),(18,801));i=int(w[0]);q=int(w[1])
    o=dict(means=avg.tolist(),groups=grouped.tolist(),shots=per.tolist(),group_wins=int(winner.sum()),joint=bool((avg[0]<avg[1:]).all() and winner.sum()>=5),worst=dict(shot=roster[i]['target']['path'],point=q,time_ms=float(GRID[q]),target=float(targets[i][q]),raw_V=float(raw[i][q]),baseline_V=float(base[i]),all_roles=pred[i,:,q].tolist(),residuals=d[i,:,q].tolist()),forecast=lock['sha256'],target_digests=[r['target']['sha256'] for r in roster])
    print('SCORE',json.dumps(o,separators=(',',':')))
if __name__=='__main__':main()
