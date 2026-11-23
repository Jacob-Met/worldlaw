"""Independent direct recount of every frozen held-port residual."""
import io,json,sys,zipfile
import numpy as np
from independent_source import check
def recount(pred_path,truth_path):
    assert check(pred_path)['admitted']
    with zipfile.ZipFile(pred_path) as z:
        pred=np.load(io.BytesIO(z.read('forecasts.npy')),allow_pickle=False)
    state=[];max_gap=0.;residuals=0
    with zipfile.ZipFile(truth_path) as z:
        rep=json.loads(z.read('result.json'))
        for k,name in enumerate(rep['conditions']):
            with np.load(io.BytesIO(z.read(name+'.npz')),allow_pickle=False) as d:x=d['frf']
            coords=[(6,j) for j in range(7)]+[(i,6) for i in range(6)]
            y=np.array([x[i,j] for i,j in coords])
            power=np.sum(y.real*y.real+y.imag*y.imag)
            row=[]
            for j,g in enumerate(pred[k]):
                delta=g-y
                squared=delta.real*delta.real+delta.imag*delta.imag
                ratio=float(np.sqrt(np.sum(squared)/power));row.append(ratio)
                max_gap=max(max_gap,abs(ratio-rep['per_state'][k][j]))
                if j==0:
                    p,f=map(int,np.unravel_index(np.argmax(squared),squared.shape))
                    recorded=rep['worst_one_per_state'][k]
                    assert p==recorded['component'] and f==recorded['frequency_index']
                    assert complex(*recorded['true'])==y[p,f]
                    for arm,v in enumerate(recorded['pred']):assert complex(*v)==pred[k,arm,p,f]
                residuals+=delta.size
            state.append(row)
    assert max_gap<1e-10
    state=np.array(state);mean=state.mean(0);worst=state.max(0)
    decisions={'mean':list(map(bool,mean[0]<mean[1:])),'worst':list(map(bool,worst[0]<worst[1:]))}
    assert decisions==rep['gates'] and all(decisions['mean']+decisions['worst'])==rep['joint']
    return {'complex_residuals':residuals,'targets':residuals//8,'max_score_delta':max_gap,'gates':decisions,'joint':rep['joint'],'raw_worst_confirmed':4}
if __name__=='__main__':print(json.dumps(recount(*sys.argv[1:]),sort_keys=True))
