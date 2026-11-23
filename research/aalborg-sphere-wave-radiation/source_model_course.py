"""Evaluate the finite fitted-model roster on lower and middle releases only."""
import hashlib
import io
import json
from urllib.request import urlopen
import zipfile
import numpy as np
from lower_release_native_clock import read_source, URL, SHA, GRID
from radiation_fit import heldout_development, MODEL_FAMILIES

def main():
    with urlopen(URL,timeout=45) as response:
        data=response.read(17549046)
    assert len(data)==17549045 and hashlib.sha256(data).hexdigest()==SHA
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        panels=read_source(z)
    scores=heldout_development(panels['01'],panels['03'])
    choices={}
    for family in MODEL_FAMILIES:
        subset=[key for key in scores if key[0]==family]
        best=min(subset,key=lambda key:(scores[key]['rms_m'],key[1],key[2]))
        choices[family]=list(best[1:])
        for key in subset:
            print(json.dumps({'family':key[0],'knot_step':key[1],'ridge':key[2],**scores[key]}),flush=True)
    for name,signal in [('zero',np.zeros((len(GRID),3))),('linear_amplitude_low',3*panels['01'][:,:,1:].mean(axis=0))]:
        errors=signal[None,:,:]-panels['03'][:,:,1:]
        i,t,g=np.unravel_index(np.abs(errors).argmax(),errors.shape)
        print(json.dumps({'role':name,'rms_m':float(np.sqrt(np.mean(errors**2))),
                          'per_gauge_rms_m':np.sqrt(np.mean(errors**2,axis=(0,1))).tolist(),
                          'worst':{'rep':int(i)+1,'time_s':float(GRID[t]),'gauge':int(g)+1,
                                   'pred_m':float(signal[t,g]),'obs_m':float(panels['03'][i,t,g+1])}}),flush=True)
    print(json.dumps({'chosen_training_only':choices,'high_release_members_opened':0}),flush=True)
if __name__=='__main__':
    main()
