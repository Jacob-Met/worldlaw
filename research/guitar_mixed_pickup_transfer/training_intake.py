"""Build forecast conditioning from singles and odd-position mixed spectra only."""
import hashlib
import json
from pathlib import Path
import sys
import numpy as np
from mode_features import setup,single_case,mixed_case


def run(directory):
    src=setup();directory.mkdir(exist_ok=False)
    parts=directory/'parts';parts.mkdir()
    ledger={};singles=np.zeros((6,8,3,25),dtype=np.complex128)
    train=np.zeros((6,4,2,25),dtype=np.float64)
    for s in range(1,7):
        for j in range(1,9):
            z,m=single_case(src,s,j);singles[s-1,j-1]=z
            ledger[f'{s}/{j}/singles']=m
            np.savez(parts/f'{s}-{j}-singles.npz',values=z,metadata=json.dumps(m))
            if j%2:
                for pick in (4,5):
                    y,m=mixed_case(src,s,j,pick);train[s-1,(j-1)//2,pick-4]=y;ledger[f'{s}/{j}/{pick}']=m
                    np.savez(parts/f'{s}-{j}-{pick}.npz',values=y,metadata=json.dumps(m))
        print(json.dumps({'string_complete':s,'source_single_wavs':24,'training_mixed_wavs':8,'held_mixed_wavs':0}),flush=True)
    assert np.isfinite(singles).all() and np.isfinite(train).all() and (np.abs(train).sum(axis=-1)>0).all()
    np.save(directory/'singles.npy',singles,allow_pickle=False);np.save(directory/'training-mixed.npy',train,allow_pickle=False)
    (directory/'metadata.json').write_text(json.dumps(ledger,sort_keys=True)+'\n')
    print(json.dumps({'shape_singles':singles.shape,'shape_training':train.shape,'inputs':{f.name:[f.stat().st_size,hashlib.sha256(f.read_bytes()).hexdigest()] for f in sorted(directory.iterdir()) if f.is_file()},'owner_path':str(directory),'held_mixed_wavs':0}),flush=True)


if __name__=='__main__':
    run(Path(sys.argv[1]))
