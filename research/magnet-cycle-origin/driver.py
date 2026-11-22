"""Run the native source qualification or a single precommitted input-only material."""
import hashlib
import json
import os
from pathlib import Path
import sys
import time
import numpy as np
import torch
from course import CHALLENGE_SHA, COUNTS, UIDS, at, data_path, read_inputs, verify_sources, submitted, maintained, sydney
from origin import transforms

def sha(raw): return hashlib.sha256(raw).hexdigest()

def save(path,data):
    with path.open('x') as f: json.dump(data,f,indent=2,allow_nan=False)
    print('RECEIPT',path.name,sha(path.read_bytes()),flush=True)

def bound(root):
    checksum=hashlib.sha256()
    with (root/'final-competition-share.zip').open('rb') as f:
        while part:=f.read(1<<22): checksum.update(part)
    assert checksum.hexdigest()==CHALLENGE_SHA
    verify_sources(root)

def qualification(root):
    B,F,T,Y=read_inputs(root,'Training','B',True)
    src=data_path(root,'Paderborn')/'src';sys.path.insert(0,str(src))
    with at(src):
        from utils.experiments import get_waveform_est
        labels=get_waveform_est(B); classes=np.unique(labels)
    selected=np.sort(np.concatenate([np.flatnonzero(labels==k)[:40] for k in classes]))
    x,f,t,y=B[selected],F[selected],T[selected],Y[selected]
    base,meta=submitted(root,'B',x,f,t,probe=True,require_complete=True)
    views,anchors=transforms(x,'B')
    rotated,mrot=submitted(root,'B',views['rotated'],f,t)
    reused=maintained(root,'B',x,f,t)
    alt=sydney(root,'B',x,f,t)
    difference=abs(rotated-base);i=int(difference.argmax());idx=int(selected[i])
    raw={'original_training_index':idx,'local_rotation_row':i,'shift':int(anchors['r'][i]),'frequency_Hz':float(f[i]),'temperature_C':float(t[i]),'measured_Wm3':float(y[i]),'native_Wm3':float(base[i]),'rotated_Wm3':float(rotated[i]),'maintained_Wm3':float(reused[i]),'sydney_Wm3':float(alt[i]),'B_first3_T':x[i,:3].tolist(),'B_range_T':[float(x[i].min()),float(x[i].max())]}
    out={'source_archive':CHALLENGE_SHA,'dataset':'Training/Material B','full_class_counts':{int(k):int((labels==k).sum()) for k in classes},'selected_ids':selected.tolist(),'versions':{'python':sys.version,'torch':torch.__version__,'numpy':np.__version__},'probe':meta,'rotated_meta':mrot,'raw_worst_rotation':raw,'rotated_mean_abs_Wm3':float(difference.mean()),'unrotated_baseline_mae_Wm3':float(abs(base-y).mean()),'maintained_mae_Wm3':float(abs(reused-y).mean()),'sydney_mae_Wm3':float(abs(alt-y).mean()),'official_test_data_accessed':False}
    save(root/'training-native-qualification.json',out)
    print('TRAIN_RAW',raw,'NATIVE',meta,'CLASSES',out['full_class_counts'],flush=True)

def forecast(root,letter):
    qualification=json.loads((root/'training-native-qualification.json').read_text())
    assert qualification['probe']['max_relative']<=1e-4
    B,F,T,_=read_inputs(root,'Testing',letter);views,anchors=transforms(B,letter)
    data={};stats={};desc=[]
    # These hashes characterize the order-insensitive features independently of all outcomes.
    for b,f,t in zip(B,F,T):
        sorted_b=np.sort(b); abs_d=np.sort(np.abs(b-np.roll(b,1))); sorted_b[sorted_b==0]=0
        identity=hashlib.sha256(letter.encode()+np.array([f,t],dtype='<f8').tobytes()+sorted_b.astype('<f8').tobytes()+abs_d.astype('<f8').tobytes()).digest()
        desc.append(np.frombuffer(identity,dtype=np.uint8))
    data['descriptor']=np.stack(desc)
    for name,v in anchors.items():data['origin_'+name]=v
    for stage in ['original','rotated','voltage','field']:
        t0=time.monotonic()
        p,info=submitted(root,letter,views[stage],F,T)
        data['winner_'+stage]=p
        info['elapsed_s']=time.monotonic()-t0;stats['winner_'+stage]=info
        print('ARM',letter,stage,info,flush=True)
    for team,model in [('maintained',maintained),('sydney',sydney)]:
        for stage in ['original','rotated']:
            t0=time.monotonic(); predictions=model(root,letter,views[stage],F,T)
            data[team+'_'+stage]=predictions
            stats[team+'_'+stage]={'elapsed_s':time.monotonic()-t0,'rows':len(B)}
            print('ARM',letter,team,stage,stats[team+'_'+stage],flush=True)
    out=root/f'forecast-{letter}.npz'
    with out.open('xb') as fp: np.savez_compressed(fp,**data)
    record={'material':letter,'rows':len(B),'phase_input_byte_equality_verified':{'voltage':len(B),'field':len(B)},'archive_sha':CHALLENGE_SHA,'hash':sha(out.read_bytes()),'input_hashes':{k:sha(np.ascontiguousarray(v).tobytes()) for k,v in [('B',B),('F',F),('T',T)]},'array_hashes':{k:sha(v.tobytes()) for k,v in data.items()},'logged':stats,'scientific_fields':['B_Field','Frequency','Temperature'],'test_H_loss_opened':False,'n_rows':len(B)}
    save(root/f'forecast-{letter}.json',record);print('PREDICTIONS',letter,record['hash'],flush=True)

if __name__=='__main__':
    root=Path(sys.argv[1]);mode=sys.argv[2]
    torch.set_num_threads(2);torch.set_num_interop_threads(1)
    bound(root)
    if mode=='qualify': qualification(root)
    elif mode=='forecast': forecast(root,sys.argv[3])
    else:raise ValueError(mode)
