"""Post-score source-matrix diagnostic at the fixed whole-course worst coordinate."""
from pathlib import Path
import numpy as np
from subset_transfer import SITES,PORTS,fit_gain,reciprocal_defect
import json,sys,zipfile
with zipfile.ZipFile('outcomes.zip') as z:sc=json.loads(z.read('result.json'))
indices=sorted({s['frequency_index'] for s in sc['worst_one_per_state']})
with np.load('baseline-input.npz') as f:
 y=f['frf'][:,:,indices];hz=f['frequency'].ravel()[indices]
with np.load('six-input.npz') as f:c=f['frf'][:6,:6,indices]
for pos,idx in enumerate(indices):
 h=y[:,PORTS,pos];w,q=fit_gain(h)
 b=y[:6,SITES,pos];sv=np.linalg.svd(b,compute_uv=False)
 print('WORST_REGISTERED_SOURCE',idx,float(hz[pos]),json.dumps(q),sv.tolist(),flush=True)
 if w is not None:
  d=(c[:,:,pos]-h[:6,:6])/w[:6];bi=np.linalg.inv(b);t=bi@((d+d.T)*.5)@bi.T
  print('WORST_REGISTERED_CORE',reciprocal_defect(d),np.linalg.svd(t,compute_uv=False).tolist(),flush=True)
