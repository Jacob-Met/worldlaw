"""Compare identical frozen transfer maps under simulated versus measured motion."""
import hashlib
import json
from pathlib import Path
import sys
import numpy as np
p=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).parent
archive=p/'forecast-lock.npz'
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='9ab6306f9f9b0665873c73e3e8d2866d9c50140a935e54520312e427591b3f7f'
out={}
with np.load(archive,allow_pickle=False) as a:
    for v in ('RANS2','RANS3','RANS4','RANS5'):
        t=a['solver_'+v+'_clock']
        ix=np.rint(t*500).astype(int)
        assert np.array_equal(ix/500,t)
        entry={}
        for f in ('constant_area','cap_tied'):
            simulated=a['solver_'+v+'_'+f]
            measured=a['motion_'+f][:,ix]
            discrepancy=simulated[np.newaxis,:,:]-measured
            mag=np.sqrt(np.mean(discrepancy**2))
            per=np.sqrt(np.mean(discrepancy**2,axis=(0,1)))
            direct=a['solver_'+v+'_submitted']-simulated
            entry[f]={'same_map_input_rms_mm':float(mag*1000),
                      'same_map_input_rms_by_gauge_mm':(per*1000).tolist(),
                      'submitted_to_mapped_rms_mm':float(1000*np.sqrt(np.mean(direct**2)))}
        out[v]={'grid_rows':len(ix),'end_s':float(t[-1]),'maps':entry}
print(json.dumps(out,sort_keys=True,indent=2))
