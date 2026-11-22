"""Verify the candidate's reported same-cell forecasts against the complete original lock."""
import hashlib
import io
import json
from pathlib import Path
import sys
import zipfile
import numpy as np
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).parent
content=(root/'forecast-lock.npz').read_bytes()
registry=json.loads((root/'forecast-registry.json').read_text())
score=json.loads((root/'score-original.json').read_text())
assert hashlib.sha256(content).hexdigest()==registry['archive_sha256']==score['archive_sha']
cell=score['rows']['motion_cap_tied']['worst'];i=cell['rep']-1;g=cell['gauge']-1;t=cell['t']
reported=score['worst_same_cell_forecasts_m']
match={}
with zipfile.ZipFile(io.BytesIO(content)) as z:
    arrays={}
    for n,(shape,sha) in registry['members'].items():
        b=z.read(n+'.npy');assert hashlib.sha256(b).hexdigest()==sha
        a=np.load(io.BytesIO(b),allow_pickle=False)
        assert list(a.shape)==shape
        arrays[n]=a
    for n,a in arrays.items():
        if n.endswith('_clock'): continue
        grid=arrays['solver_'+n.split('_')[1]+'_clock'] if n.startswith('solver_') else np.arange(3025)/500
        ix=np.flatnonzero(grid==t)
        if not len(ix):continue
        j=int(ix[0]);pred=float(a[i,j,g] if a.ndim==3 else a[j,g])
        assert pred==reported[n];match[n]=pred
assert set(match)==set(reported)
actual=score['worst_measured_episode'][score['worst_episode_grid_s'].index(t)][g]
assert actual==cell['actual_m'] and match['motion_cap_tied']-actual==cell['error_m']
print(json.dumps({'registered_forecast_sha':registry['archive_sha256'],'source_score_sha':hashlib.sha256((root/'score-original.json').read_bytes()).hexdigest(),
                  'complete_raw_cell_forecasts':len(match),'repetition':i+1,'gauge':g+1,'time_s':t,'measured_m':actual,
                  'signed_errors_m':{n:v-actual for n,v in match.items()}},sort_keys=True))
