"""Recount all 35 forecasts by explicit organizer [sample, period, amplitude] indices."""
import io
import json
import math
import sys
import zipfile
from hashlib import sha256
from pathlib import Path
import numpy as np
from scipy.io import loadmat

root=Path(sys.argv[1]); assert sys.argv[2]=='recount'; score_hash,pred_hash=sys.argv[3:5]

def checked(filename,digest):
    raw=(root/filename).read_bytes()
    assert sha256(raw).hexdigest()==digest
    return raw

def rmse(errors):
    return 1000*math.sqrt(math.fsum(float(x)*float(x) for x in errors)/len(errors))

first=json.loads(checked('official-locked-scores.json',score_hash)); assert first['prediction_sha']==pred_hash
p=np.load(io.BytesIO(checked('official-input-only-predictions.npz',pred_hash)),allow_pickle=False)
raw=checked('ParWHFiles.zip','9d01efe9264a921f83b326ee72fdd1ba0e87063cb67265b750efb8e04a4b385d')
with zipfile.ZipFile(io.BytesIO(raw)) as z:
    truth=loadmat(io.BytesIO(z.read('ParWHFiles/ParWHData.mat')),variable_names=['yVal'])['yVal']
assert truth.shape==(16384,2,1,5); N=16384
all_rows=[]
for row in first['rows']:
    role,amp=row['role'],row['amp']; literal=role in ('literal','fir_literal'); pred=p[f'{role}_{amp}']
    suffix=[]; common=[]; period=[[],[]]; topology=[]
    for t in range(2*N):
        s,b=(t//2,t%2) if literal else (t%N,t//N)
        pt=b*N+s; lt=2*s+b
        if t>=50:
            delta=pred[t]-truth[s,b,0,amp]; suffix.append(delta); topology.append((t,pt))
            if pt>=50 and lt>=50: common.append(delta); period[b].append(delta)
    assert len(suffix)==32718 and len(common)==32693
    score=rmse(suffix); shared=rmse(common); per=[rmse(x) for x in period]
    ix=max(range(len(suffix)),key=lambda i:abs(suffix[i]))
    assert topology[ix]==(row['worst']['evaluation_index'],row['worst']['physical_row'])
    assert abs(suffix[ix]*1000-row['worst']['signed_error_mV'])<1e-10
    diffs=[abs(score-row['rmse_mV']),abs(shared-row['common_mV'])]+[abs(a-b) for a,b in zip(per,row['common_period_mV'])]
    assert max(diffs)<1e-9
    all_rows.append({'role':role,'amp':amp,'suffix_mV':score,'common_mV':shared,'period_mV':per,'worst_physical_row':topology[ix][1],'max_recount_difference_mV':max(diffs)})
assert len(all_rows)==35 and len({(e['role'],e['amp']) for e in all_rows})==35
out={'pred_sha':pred_hash,'score_sha':score_hash,'scalars':140,'max_difference_mV':max(e['max_recount_difference_mV'] for e in all_rows),'raw_worst_coordinates_verified':35,'rows':all_rows}
path=root/'independent-physical-recount.json'
with path.open('x') as f: json.dump(out,f,indent=2,allow_nan=False)
print('RECOUNT',sha256(path.read_bytes()).hexdigest(),out['scalars'],out['max_difference_mV'],out['raw_worst_coordinates_verified'])
