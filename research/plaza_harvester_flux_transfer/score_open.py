"""Read held terminal samples only after authenticating the full 45-member prediction lock."""
import hashlib
import json
import re
from pathlib import Path
import numpy as np
from flux import KINDS, measured, summary

HELD=(37,38,39,40,41)
CUTS=np.r_[np.arange(0,1000,10),999]
DT=np.diff(CUTS)[:,None]/100.

def score(exposure,forecast,expected_sha,raw_root):
    if hashlib.sha256(forecast.read_bytes()).hexdigest()!=expected_sha:
        raise ValueError('substituted forecast archive')
    enrolled={}
    for r in json.loads(exposure.read_bytes())['roster']:
        if r['folder']=='Measurements':
            i=int(re.search(r'exp(\d+)',r['name']).group(1))
            if i in HELD:enrolled[i]=r
    if tuple(sorted(enrolled))!=HELD:raise ValueError('held membership')
    with np.load(forecast,allow_pickle=False) as ar:
        ps={k:ar[k] for k in ar.files}
    if set(ps)!={f'{i}-{r}' for i in HELD for r in KINDS}:raise ValueError('member census')
    if any(z.shape!=(100,24) or not np.isfinite(z).all() for z in ps.values()):raise ValueError('unqualified array')
    scores={};physical={};finite_gate=True;ref={}
    for i in HELD:
        path=raw_root/(f'{i:02d}-terminal.csv')
        row=enrolled[i]
        if path.stat().st_size!=row['bytes'] or hashlib.sha256(path.read_bytes()).hexdigest()!=row['sha256']:
            raise ValueError('electrical original mismatch')
        u,dv,vol=measured(path,CUTS);ref[str(i)]=u
        ok=np.isfinite(u);finite_gate &= bool(ok.sum()>=.95*ok.size and ok.any(axis=0).all())
        physical[i]={'raw_sha256':row['sha256'],'rows':len(vol),'max_abs_printed_V':float(np.nanmax(abs(vol))),
            'cells_above_or_at_nominal_full_scale':int(np.sum(abs(vol)>=1.65)),
            'missing_adc_coordinates_zero_based':np.argwhere(~np.isfinite(vol)).tolist(),
            'missing_reference_coordinates_zero_based':np.argwhere(~ok).tolist(),
            'all_integrals_volt_seconds':np.where(ok,u,0.).tolist()}
        scores[i]={}
        for r in KINDS:
            pred=ps[f'{i}-{r}'];entry=summary(pred,u,DT)
            w,k=entry['window'],entry['coil']-1;a,b=CUTS[w:w+2]
            entry['same_cell_all_role_mean_voltage']={name:float(ps[f'{i}-{name}'][w,k]/DT[w,0]) for name in KINDS}
            entry['same_raw_electrical_window']={'time_s':np.arange(a,b+1).astype(float).__truediv__(100).tolist(),
                                                'voltage_V':vol[a:b+1,k].tolist(),'coil':k+1}
            scores[i][r]=entry
    means={r:float(np.mean([scores[i][r]['rms_V'] for i in HELD])) for r in KINDS}
    structures=[r for r in KINDS if r not in ('shared-flux','nominal-load')]
    strict={a:{r:means[a]<means[r] for r in structures} for a in ('shared-flux','nominal-load')}
    wins={r:sum(scores[i]['shared-flux']['rms_V']<scores[i][r]['rms_V'] for i in HELD) for r in ('shared-path','load-blind')}
    accepted=finite_gate and all(all(x.values()) for x in strict.values()) and min(wins.values())>=4
    return dict(sha256=expected_sha,mean_RMS_V=means,per_run=scores,physical=physical,
                joint_strict=strict,five_run_wins=wins,measurement_gate=finite_gate,accepted=accepted)

if __name__=='__main__':
    import sys
    exposure,forecast,expected_sha,raw,out=sys.argv[1:]
    result=score(Path(exposure),Path(forecast),expected_sha,Path(raw))
    Path(out).write_text(json.dumps(result,sort_keys=True,separators=(',',':'),allow_nan=False)+'\n')
