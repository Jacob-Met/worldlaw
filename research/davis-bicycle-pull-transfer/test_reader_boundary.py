"""Synthetic poisoned-angle check for the forecast reader's held variable boundary."""
import copy,hashlib,io,json,os,tempfile
from pathlib import Path
from unittest.mock import patch
import numpy as np
from scipy.io import savemat
import predict_locked as p

def run(poison):
    split=json.loads(Path('split.json').read_text())
    holder=set(split['held_ids']);base={q['RunID']:q for q in json.loads(Path('design.json').read_text())}
    source=Path('development.json').read_bytes();protocol=Path('frozen-protocol.json').read_bytes()
    original=Path.cwd();t=np.arange(3500)/200
    blobs={};rows=[]
    for ident,record in base.items():
        u=np.sin(t*.8);u[1500:1510]+=70;u[2000:2011]-=75
        roll=np.sin(t);steer=np.cos(t)
        if poison and ident in holder:roll=7000+1300*roll;steer=3000*np.sin(37*t)
        f=io.BytesIO();savemat(f,{'RunID':ident,'PullForce':u,'NISampleRate':200.,
                      'Speed':record['Speed'],'ForwardSpeed':np.zeros_like(u)+record['Speed'],
                      'RollAngle':roll,'SteerAngle':steer})
        blobs[ident]=f.getvalue()
        q=copy.copy(record);q['sha256']=hashlib.sha256(f.getvalue()).hexdigest();rows.append(q)
    accepted=[]
    real=p.read_angles
    def checked(raw,digest):
        i=next(k for k,b in blobs.items() if b is raw)
        assert i not in holder
        accepted.append(i)
        return real(raw,digest)
    with tempfile.TemporaryDirectory() as tmp:
        try:
            os.chdir(tmp)
            Path('design.json').write_text(json.dumps(rows));Path('split.json').write_text(json.dumps(split))
            Path('development.json').write_bytes(source);Path('frozen-protocol.json').write_bytes(protocol)
            with patch.object(p,'original_measurements',return_value=None),patch.object(p,'named_members',return_value=list(blobs.items())),patch.object(p,'read_angles',side_effect=checked),patch.object(p,'training_stats',side_effect=lambda u,y,fs:{'yy':np.var(y,axis=0)}),patch.object(p,'author_kernel',return_value=np.zeros((5,2))),patch.object(p,'fit',return_value=np.zeros((5,2))),patch.object(p,'feedback',side_effect=lambda u,*_:np.column_stack([u,u])),patch('builtins.print'):
                p.main()
            assert set(accepted)==set(split['source_ids'])
            return hashlib.sha256(Path('predictions.zip').read_bytes()).hexdigest(),len(accepted)
        finally:os.chdir(original)
if __name__=='__main__':
    a=run(False);b=run(True);assert a==b
    print('identical synthetic forecast byte archive despite poisoned held orientation; source reads per arm',a)
