"""Score every prelocked contact prediction against its corresponding released ATI trace."""
import hashlib
import json
import numpy as np
from contact_models import ARMS,HELD,original,smooth,table


def metrics(t,p,y,select):
    idx=np.flatnonzero(select)
    if len(idx)==0:
        raise ValueError('Registered subset has no examples')
    err=p[idx]-y[idx]
    planar=np.linalg.norm(err[:,3:5],axis=1)
    w=int(np.argmax(planar))
    return {'rows':len(idx),'rms_planar_Nm':float(np.sqrt(np.mean(planar**2))),
            'peak_planar_Nm':float(planar[w]),'component_rmse':np.sqrt((err**2).mean(axis=0)).tolist(),
            'worst_row':int(idx[w]),'worst_time_s':float(t[idx[w]]),
            'worst_actual':y[idx[w]].tolist(),'worst_predicted':p[idx[w]].tolist()}


def score(source,lock,lock_sha):
    if hashlib.sha256((lock/'lock.json').read_bytes()).hexdigest()!=lock_sha:
        raise ValueError('Immutable forecast ledger differs')
    ledger=json.loads((lock/'lock.json').read_text())
    for n,sha in ledger['sha256'].items():
        if hashlib.sha256((lock/n).read_bytes()).hexdigest()!=sha:raise ValueError('Frozen asset differs')
    if tuple(ledger['arms'])!=ARMS or tuple(ledger['held'])!=HELD:raise ValueError('Frozen roster differs')
    result={'arms':ARMS,'lock_sha256':lock_sha,'records':{}}
    with original(source) as z, np.load(lock/'locked.npz',allow_pickle=False) as pp:
        for run in HELD:
            t=pp[run+'_t'];pred=pp[run+'_forecasts']
            y=smooth(t,table(z,'contact_motion/'+run,'base_wrench',6,t)[1])
            included=np.ones(len(t),dtype=bool)
            arrays={'whole':included}
            if run=='push_retract':arrays['contact']=pp[run+'_mask']
            entry={name:{arm:metrics(t,pred[:,i],y,m) for i,arm in enumerate(ARMS)} for name,m in arrays.items()}
            primary=entry['whole']['component_101_27g'];worst=primary['worst_row']
            entry['worst_bias_witness']={
                'row':worst,'t':float(t[worst]),'all_arms_wrenches':pred[worst].tolist(),
                'positions_m':pp[run+'_positions'][worst].tolist(),'wand_pose':pp[run+'_wand_pose'][worst].tolist(),
                'true_wrench':y[worst].tolist()}
            result['records'][run]=entry
    main=result['records']['push_retract']['whole']
    keys=('rms_planar_Nm','peak_planar_Nm')
    gates={k:all(main['component_101_27g'][k]<main[a][k] for a in ARMS if a!='component_101_27g') for k in keys}
    result.update(gates=gates,joint=all(gates.values()))
    return result
