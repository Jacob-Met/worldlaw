"""Compile challenge inputs using the unchanged training-only TorchScript heads."""
from contextlib import contextmanager
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import time
import zipfile
import numpy as np
import pandas as pd
import torch

CHALLENGE_SHA='f110f3917004154624cf820af5fc74d9657fe0e3759fe928835da567e475c0b7'
MATERIALS=['3C92','T37','3C95','79','ML95S']
UIDS=['d893c778','b6a920cc','c1ced7b6','11672810','5ae50f9e']
COUNTS={'Training':[2432,7400,5357,580,2013],'Testing':[7651,3172,5357,7299,3738]}
WORDS=['wav_other','wav_square','wav_triangular','wav_sine']
NC=1024

def data_path(root,team):
    return root/'scientific-source'/'models'/team/'Model'

def read_inputs(root,split,letter,training_loss=False):
    assert split in COUNTS and (not training_loss or split=='Training')
    with zipfile.ZipFile(root/'final-competition-share.zip') as z:
        selected=['B_Field','Frequency','Temperature']
        if training_loss: selected.append('Volumetric_Loss')
        vals={}
        for name in selected:
            with z.open(f'{split}/Material {letter}/{name}.csv') as stream:
                vals[name]=np.loadtxt(stream,delimiter=',',dtype=np.float64)
    B=vals['B_Field'];assert B.shape==(COUNTS[split][ord(letter)-65],NC)
    assert all(np.isfinite(v).all() and len(v)==len(B) for v in vals.values())
    return B,vals['Frequency'],vals['Temperature'],vals.get('Volumetric_Loss')

def verify_sources(root):
    records=json.loads((root/'model-source-ledger.json').read_text())
    assert len(records)==26
    assert hashlib.sha256((root/'model-source-ledger.json').read_bytes()).hexdigest()=='eb9075d341a89e4406ac1dbb95c764921ababd45f72cff7dd34e6ee7c7b4fa5c'
    for path,blob,digest,size in records:
        raw=(root/'scientific-source'/path).read_bytes()
        assert len(raw)==size and hashlib.sha256(raw).hexdigest()==digest and hashlib.sha1(b'blob '+str(size).encode()+bytes([0])+raw).hexdigest()==blob

@contextmanager
def at(path):
    previous=os.getcwd();os.chdir(path)
    try: yield
    finally: os.chdir(previous)

def submitted(root,letter,B,F,T,probe=False,require_complete=False):
    """Use one full material batch for both feature normalization and inference."""
    source=data_path(root,'Paderborn')/'src';sys.path.insert(0,str(source))
    with at(source):
        import run_cnn_inference as ref
        from utils.experiments import engineer_features
        from run_cnn_training import construct_tensor_seq2seq,FREQ_SCALE
        uid=UIDS[ord(letter)-65]; path=next(ref.MODEL_SINK.glob('*'+uid+'*.pt'))
        model=torch.jit.load(str(path));model.eval()
        frame=pd.DataFrame(B,columns=ref.ALL_B_COLS).assign(freq=F,temp=T,material=letter)
        direct=None
        if probe: direct=ref.run_inference(uid,frame.copy()).to_numpy()
        ds=engineer_features(frame,with_b_sat=False)
        cols=[c for c in ds if c not in ['ploss','kfold','material'] and not c.startswith(('B_t_','H_t_'))]
        misses=[c for c in WORDS if c not in cols]
        if require_complete and misses: raise ValueError(('missing classes in authentic batch',misses))
        present=[c for c in WORDS if c in ds]
        info={c:int(ds[c].sum()) for c in present}
        limit_b=json.loads((source.parent/'data/b_max_dict.json').read_text())[letter]
        limit_h=json.loads((source.parent/'data/h_max_dict.json').read_text())[letter]
        bpp=np.abs(ds.loc[:,ref.ALL_B_COLS].to_numpy()).max(axis=1).reshape(-1,1)
        hpp=limit_h*bpp/limit_b
        xt,xs=construct_tensor_seq2seq(ds,cols,limit_b,hpp,b_limit_pp=bpp,training_data=False)
        if misses:
            # Supplement only: preserve computed columns, insert missing one-hot zeros
            # after normalization so absent classes do not induce division by zero.
            full_cols=[c for c in cols if not c.startswith('wav_')]
            loc=full_cols.index('temp')+1
            full_cols[loc:loc]=WORDS
            xs=torch.stack([xs[:,cols.index(c)] if c in cols else torch.zeros_like(xs[:,0]) for c in full_cols],dim=1)
        b_lim=torch.tensor(limit_b,dtype=torch.float32); fscale=torch.tensor(FREQ_SCALE,dtype=torch.float32)
        with torch.inference_mode():
            p,h=model(xt.permute(1,2,0),xs,b_lim,torch.as_tensor(hpp,dtype=torch.float32),fscale)
            pred=np.exp(p.detach().numpy().ravel())
        assert np.all(np.isfinite(pred)) and np.all(pred>0)
        metrics={'missing_native_columns':misses,'waveform_counts':info,'forward_chunk':len(B),'rows':len(B)}
        if direct is not None:
            delta=np.abs(pred-direct); peak=int(delta.argmax())
            metrics.update(native_probe_rows=len(direct),max_abs_Wm3=float(delta[peak]),max_relative=float(np.max(delta/direct)))
            np.testing.assert_allclose(pred,direct,rtol=1e-4,atol=.01)
        return pred,metrics

def maintained(root,letter,B,F,T):
    path=root/'scientific-source/src_py/magnethub/paderborn_loss.py'
    spec=importlib.util.spec_from_file_location('maintained_paderborn_model',path)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    fname=next((data_path(root,'Paderborn')/'data/models').glob('*'+UIDS[ord(letter)-65]+'*.pt'))
    instance=mod.PaderbornModel(fname,MATERIALS[ord(letter)-65]); parts=[]
    for low in range(0,len(B),64):
        sl=slice(low,low+64);p,_=instance(B[sl],F[sl],T[sl]);parts.append(np.atleast_1d(p))
    p=np.concatenate(parts); assert len(p)==len(B) and np.all(np.isfinite(p))
    return p

def sydney(root,letter,B,F,T):
    source=data_path(root,'Sydney');sys.path.insert(0,str(source))
    from Model import MMINet
    from Data import get_dataloader
    label='Material '+letter; model=MMINet(label)
    weights=torch.load(str(source/(label+'.pt')),map_location='cpu',weights_only=True)
    model.load_state_dict(weights,strict=True);model.eval()
    original=get_dataloader(B,F,T,model.norm)
    # The organizer uses pinned CUDA transport. The same precomputed tensors,
    # same original order and batch size enter the unmodified model on CPU.
    loader=torch.utils.data.DataLoader(original.dataset,batch_size=128,num_workers=0,pin_memory=False,shuffle=False)
    parts=[]
    with torch.inference_mode():
        for inputs,vals,state in loader:
            parts.append(model(inputs,vals,state).detach().cpu().numpy())
    p=np.concatenate(parts)
    assert len(p)==len(B) and np.isfinite(p).all()
    return p
