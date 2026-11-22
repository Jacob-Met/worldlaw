"""Score a prospectively locked ParWH forecast. Arguments include two prior published digests."""
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path
import numpy as np
from scipy.io import loadmat

ROOT=Path(sys.argv[1]); MODE=sys.argv[2]; LOCK_SHA=sys.argv[3]; PRED_SHA=sys.argv[4]
N=16384

def sha(x): return hashlib.sha256(x).hexdigest()

def checked(path, expected):
    raw=(ROOT/path).read_bytes(); assert sha(raw)==expected, path
    return raw

lock=json.loads(checked('prediction-lock.json',LOCK_SHA))
assert lock['predictions']==PRED_SHA and lock['arrays_opened']==['uVal']
preds=np.load(io.BytesIO(checked('official-input-only-predictions.npz',PRED_SHA)),allow_pickle=False)
assert set(preds.files)==set(lock['array_hashes']) and len(preds.files)==35
for name in preds.files: assert sha(preds[name].tobytes())==lock['array_hashes'][name]
archive=checked('ParWHFiles.zip','9d01efe9264a921f83b326ee72fdd1ba0e87063cb67265b750efb8e04a4b385d')
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    d=loadmat(io.BytesIO(z.read('ParWHFiles/ParWHData.mat')),variable_names=['yVal','uVal'])
assert set(k for k in d if not k.startswith('__'))=={'yVal','uVal'}
y=d['yVal'].reshape(N,2,5); u=d['uVal'].reshape(N,2,5)
assert sha(u.tobytes())==lock['input_sha']
physical=y.swapaxes(0,1).reshape(2*N,5); ul=u.swapaxes(0,1).reshape(2*N,5); literal=y.reshape(2*N,5)
pidx=np.arange(2*N); lidx=(pidx%N)*2+pidx//N
right=pidx>=50; common=right & (lidx>=50)
assert right.sum()==32718 and common.sum()==32693

def rmse(v): return float(np.sqrt(np.mean(v**2))*1000)

def report(path,obj):
    with (ROOT/path).open('x') as f: json.dump(obj,f,indent=2,allow_nan=False)
    return sha((ROOT/path).read_bytes())

assert MODE=='score'
qual=json.loads(checked('qualification.json',lock['qualified'])); ys,yo=qual['scaler'][2:]
release=np.load(io.BytesIO(checked('released-GRU_ParWH.npz','ccd1d968c31c358d7af2b9a0eafd43db7bb759d33ed2efa20377ad079fe9f04c')),allow_pickle=False)
rows=[]; saved=[]; role_names=['literal','direct','repeat','wrong','point','fir_literal','fir_physical']
for amp in range(5):
    lp=preds[f'literal_{amp}']; saved_pred=release[f'test_{amp}'].ravel(); assert len(saved_pred)==2*N-7
    scaled=ys*lp[7:]+yo; err=abs(scaled-saved_pred); ix=int(err.argmax())
    saved_rmse=float(release['score'].ravel()[amp]); rescored=rmse(lp[50:]-literal[50:,amp]); saved.append(dict(amp=amp,max_scaled=float(err[ix]),source_index=ix+7,source_pred=float(saved_pred[ix]),receiver_scaled=float(scaled[ix]),released_mV=saved_rmse,receiver_mV=rescored,difference_mV=abs(saved_rmse-rescored)))
    for role in role_names:
        pred=preds[f'{role}_{amp}']; is_literal=role in ('literal','fir_literal'); physical_pred=pred[lidx] if is_literal else pred
        target=literal[:,amp] if is_literal else physical[:,amp]; err=pred-target; i=50+int(np.argmax(abs(err[50:])))
        pos=(i%2)*N+i//2 if is_literal else i
        entry=dict(amp=amp,role=role,suffix_rows=32718,clock='literal' if is_literal else 'physical',rmse_mV=rmse(err[50:]),common_mV=rmse((physical_pred-physical[:,amp])[common]),common_rows=32693,worst=dict(evaluation_index=i,physical_row=pos,within_period=pos%N,period_index=pos//N,truth_V=float(target[i]),prediction_V=float(pred[i]),current_input_V=float(ul[pos,amp]),signed_error_mV=float(err[i]*1000)),common_period_mV=[rmse((physical_pred-physical[:,amp])[common & (pidx//N==p)]) for p in [0,1]])
        rows.append(entry)
means={k:float(np.mean([r['rmse_mV'] for r in rows if r['role']==k])) for k in role_names}
by_role={k:np.array([r['rmse_mV'] for r in rows if r['role']==k]) for k in role_names}
joint=(by_role['repeat']<by_role['direct']) & (by_role['repeat']<by_role['wrong'])
reproduced=all(r['max_scaled']<=5e-5 and r['difference_mV']<=0.005 for r in saved)
passed=int(joint.sum())>=4 and means['repeat']<min(means['direct'],means['wrong'])
result=dict(prediction_sha=PRED_SHA,lock_sha=LOCK_SHA,rows=rows,means_mV=means,saved_score_checks=saved,native_checkpoint_reproduced=reproduced,paired_wins=joint.tolist(),physical_adapter_gate=passed,joint_gate=passed and reproduced,validation_variables=['yVal','uVal'],saved_arrays=['test_0','test_1','test_2','test_3','test_4','score'])
s=report('official-locked-scores.json',result)
print('SCORES',s,'VALUES', {k:list(v) for k,v in by_role.items()},'MEANS',means,'wins',joint.tolist(),'official',reproduced,'scaled_max', max(r['max_scaled'] for r in saved),'score_delta_max',max(r['difference_mV'] for r in saved),'RAW',max((r for r in rows if r['role']=='repeat'),key=lambda r:abs(r['worst']['signed_error_mV'])))
