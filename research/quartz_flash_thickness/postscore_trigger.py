"""Postscore decomposition with all registered rows and times preserved in the primary score."""
import base64,zlib
from model import *
roster=read_json('roster.json');score=read_json('scores.json');lock=read_json('forecast-lock.json')
payload=zlib.decompress(base64.b85decode((ROOT/'forecasts.b85').read_bytes().strip()))
assert sha(payload)==lock['sha256']
fc=np.frombuffer(payload,dtype='<f8').reshape(18,9,801)
parts=[];neighborhood=[];positive=[]
with measurements() as a:
    for i,row in enumerate(roster):
        y,raw,base=waveform(a,row['target'],'HT2')
        e=np.square(fc[i]-y[None,:])
        # Count the contributions to the original denominator, without a new fit or score.
        parts.append(np.stack([e[:,0],e[:,1:26].sum(axis=1),e[:,26:201].sum(axis=1),e[:,201:].sum(axis=1)]))
        positive.append(float(y[0]))
        if row['target']['path']==score['worst']['shot']:
            for r in [row['target']]+row['source']:
                t,v=trace(split(filedata(a,r['path']))[1]); mask=np.abs(t)<=16
                neighborhood.append({'path':r['path'],'pairs_ms_V':np.stack([t[mask],v[mask]],axis=1).tolist(),'interpolated_trigger_V':float(np.interp(0,t,v))})
p=np.stack(parts);sq=p.sum(axis=(0,1))
fraction=p.sum(axis=0)/sq[None,:]
print(json.dumps({'mode':'postscore_explanation_only','all_primary_samples_preserved':18*801,'raw_original_sha':lock['sha256'],'windows_ms':['t=0','10-250','260-2000','2010-8000'],'fraction_of_all_shot_squared_error_by_role':fraction.T.tolist(),'worst_whole_shot_fractions':(p[9]/p[9].sum(axis=0)).T.tolist(),'shot_trigger_normalized':positive,'native_neighbors':neighborhood},sort_keys=True))
