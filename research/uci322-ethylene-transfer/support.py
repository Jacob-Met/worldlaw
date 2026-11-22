"""Explain the already-opened worst crossed predictions against each source's measured feature support."""
import json
from pathlib import Path
import sys
import zipfile
import numpy as np


def main(root):
    original=json.loads((root/'held-scores.json').read_text())
    out={}
    for tgt in ('CO','methane'):
        src='methane' if tgt=='CO' else 'CO'
        source=np.load(root/f'training-view-{src}.npz',allow_pickle=False)['rows'][:,3:]
        frozen=np.load(root/f'frozen-model-{src}.npz',allow_pickle=False)
        score=original['held'][tgt]
        worst=score['worst'][src+'__nuisance']
        lo,hi=source.min(axis=0),source.max(axis=0)
        target=worst['release_index']; q=np.asarray(worst['four_sensor_channels'])
        with zipfile.ZipFile(root/'uci322-original.zip') as z,z.open('ethylene_'+tgt+'.txt') as f:
            f.readline()
            for i,line in enumerate(f):
                if i==target:
                    row=np.asarray(line.split(),float);break
        assert np.array_equal(row[3:7],q)
        x=row[3:]
        outside=np.flatnonzero((x<lo)|(x>hi))
        distances=np.maximum(np.maximum(lo-x,x-hi),0)/frozen['sensor_scale']
        worst_chan=int(np.argmax(distances))
        control=score['routes'][src]
        ordered=sorted(((v['all']['rmse_ppm'],k) for k,v in control.items() if k!='oger_native_rate'))
        out[tgt]={'source':src,'row':worst,'source_firstsecond_support_lo':lo.tolist(),'source_firstsecond_support_hi':hi.tolist(),
             'actual_sensor_values':x.tolist(),'channels_outside_train_observed_minmax_1based':(outside+1).tolist(),
             'largest_IQR_outside_source':float(distances[worst_chan]),'largest_channel_1based':worst_chan+1,
             'lowest_cross_rmse_observed':ordered[0],'best_observed_learned':next(x for x in ordered if x[1]!='mean'),
             'unclipped_oger_minmax_held_decisions':None}
        with np.load(root/f'input-only-{tgt}.npz',allow_pickle=False) as pack:
            v=pack[src+'__oger'];out[tgt]['unclipped_oger_minmax_held_decisions']=[float(v.min()),float(v.max())]
    dst=root/'exposed-support.json';dst.write_text(json.dumps(out,indent=2))
    for tgt,s in out.items():print(tgt,'BEST',s['lowest_cross_rmse_observed'],s['best_observed_learned'],'OUTSIDE',s['channels_outside_train_observed_minmax_1based'],s['largest_IQR_outside_source'],'OGER',s['unclipped_oger_minmax_held_decisions'],flush=True)


if __name__=='__main__':main(Path(sys.argv[1]))
