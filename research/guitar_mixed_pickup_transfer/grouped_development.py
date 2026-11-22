"""Leave entire marked source positions out when checking source-calibration behavior."""
import json
import sys
from pathlib import Path
import numpy as np
from switch_model import Cases,ROLES,fit_models,training,shape

def run(d):
    c=Cases(d);ids,y=training(d,c);rows=[];counts={}
    for j in (0,2,4,6):
        src=c.j[ids]!=j;xx=ids[~src];yy=y[~src]
        preds,params=fit_models(c,ids[src],y[src])
        counts[str(j)]={r:[x['evaluations'],x['status']] for r,x in params.items()}
        for idx,(i,target) in enumerate(zip(xx,yy)):
            e=preds['shared_circuit'][i]-target;k=int(np.argmax(abs(e)))
            rows.append({'s':int(c.s[i]+1),'q_mm':int(c.q[i]),'p':int(4+c.p[i]),
                         'loss':{r:float(np.sqrt(np.mean((preds[r][i]-target)**2))) for r in ROLES},
                         'worst':{'k':k+1,'true':target[k],'candidate':preds['shared_circuit'][i,k],'coherent':preds['coherent'][i,k]}})
    pred,_=fit_models(c,ids,y);idx=np.flatnonzero((c.s==1)&(c.j==0)&(c.p==1))[0]
    met=json.loads((d/'metadata.json').read_bytes())
    observed=shape(np.load(d/'training-mixed.npy')[1,0,1])[5]
    print(json.dumps({'rows':rows,'mean':{r:float(np.mean([s['loss'][r] for s in rows])) for r in ROLES},'optimizer_source':counts,
        'b3_30_midbridge_h6':{'source_target':float(observed),'coherent_dB':pred['coherent'][idx,5],'trainingfit_circuit_dB':pred['shared_circuit'][idx,5],'source_metadata':met['2/1/5']},
        'held_mixed_files':0},sort_keys=True))

if __name__=='__main__':run(Path(sys.argv[1]))
