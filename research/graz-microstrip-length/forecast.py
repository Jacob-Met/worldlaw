"""Issue all measured-plane predictions from six physical sources and two documented shorts."""
import argparse
import hashlib
import json
from pathlib import Path
import time
import zipfile
import numpy as np
from matrix_paths import predict,inversion_diagnostics
from authors import fit_author,embed_and_verify
from receiver import SOURCE_LENGTHS, HELD_LENGTHS, EXPECTED_F, line_name, read_standard

ARCHIVE_SHA='fb07e056ca519ab8c9637be7360617d3cfd4519cdd8b28597f53ad3c42308956'
ARM_NAMES=('covariance_weighted','equal_path','nominal_phase_empirical','archived_short1',
           'archived_short2','maintained_short2')
def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def empirical(means,target,frequency):
    """First-order changes of de-rotated complex transmission and harmonic return loss."""
    c=299792458.
    lengths=np.array(sorted(means))*.0005
    y=np.stack([means[l] for l in sorted(means)])
    result=np.empty((299,2,2),complex)
    for i,f in enumerate(frequency):
        beta=2*np.pi*f*np.sqrt(2.5)/c
        transmission=np.exp(-1j*beta*lengths)
        scale=lengths[-1]
        target_m=target*.0005
        d=np.column_stack((transmission,transmission*lengths/scale))
        v=np.exp(-1j*beta*target_m)*np.array([1,target_m/scale])
        for out,inc in [(1,0),(0,1)]:
            result[i,out,inc]=v@np.linalg.lstsq(d,y[:,i,out,inc],rcond=1e-12)[0]
        d=np.column_stack((np.ones(len(lengths)),np.exp(-2j*beta*lengths)))
        v=np.array([1,np.exp(-2j*beta*target_m)])
        for j in [0,1]:
            result[i,j,j]=v@np.linalg.lstsq(d,y[:,i,j,j],rcond=1e-12)[0]
    return result


def main():
    p=argparse.ArgumentParser()
    p.add_argument('archive',type=Path)
    p.add_argument('output',type=Path)
    argv=p.parse_args()
    if sha(argv.archive)!=ARCHIVE_SHA:
        raise ValueError('archive custody mismatch')
    argv.output.mkdir(parents=True,exist_ok=False)
    allowed={line_name(l) for l in SOURCE_LENGTHS}|{'short1__0_0mm','short2__0_0mm'}
    arrays={}
    info={'source_lengths_half_mm':SOURCE_LENGTHS,'held_lengths_half_mm':HELD_LENGTHS,
          'wave_ids_opened':sorted(allowed),'measured_target_members_opened':0,
          'receiver_A_condition_max':{},'source_inversion':{},'target_source_diagnostics':{},
          'timing_seconds':{}}
    t0=time.monotonic()
    frequency=None
    with zipfile.ZipFile(argv.archive) as outer:
        for name in sorted(allowed):
            arrays[name],info['receiver_A_condition_max'][name],frequency=read_standard(outer,name,allowed,frequency)
    info['frequency_hz']=frequency.tolist()
    info['max_uniform_nominal_clock_deviation_hz']=float(np.max(abs(frequency-EXPECTED_F)))
    info['timing_seconds']['receiver']=time.monotonic()-t0
    sweeps={l:arrays[line_name(l)] for l in SOURCE_LENGTHS}
    means={l:x.mean(axis=0) for l,x in sweeps.items()}
    diag=inversion_diagnostics(sweeps)
    for l,d in diag.items():
        info['source_inversion'][l]={k:v.tolist() for k,v in d.items()}
        if any(not np.all(np.isfinite(v)) for v in d.values()) or np.max(d['sample_perturbation_ratio'])>=1:
            raise ValueError(f'source inversion perturbation gate, length {l}')
    allpred={name:[] for name in ARM_NAMES}
    for label,short,current in [('archived_short1','short1__0_0mm',False),
                                ('archived_short2','short2__0_0mm',False),
                                ('maintained_short2','short2__0_0mm',True)]:
        t0=time.monotonic()
        cal=fit_author(frequency,means,arrays[short].mean(axis=0),current)
        errors=[]
        for t in HELD_LENGTHS:
            pred,inverse_error=embed_and_verify(cal,frequency,t)
            allpred[label].append(pred)
            errors.append(inverse_error)
        info[label+'_apply_cal_roundtrip']=errors
        info['timing_seconds'][label]=time.monotonic()-t0
    for t in HELD_LENGTHS:
        t0=time.monotonic()
        out=predict(sweeps,t)
        assert len(out['paths'])=={2:7,13:3}[t]
        allpred['covariance_weighted'].append(out['covariance_weighted'])
        allpred['equal_path'].append(out['equal_path'])
        allpred['nominal_phase_empirical'].append(empirical(means,t,frequency))
        info['target_source_diagnostics'][t]={
            k:(v.tolist() if isinstance(v,np.ndarray) else v)
            for k,v in out.items() if k not in ('covariance_weighted','equal_path')}
        info['timing_seconds']['paths_'+str(t)]=time.monotonic()-t0
    pred={k:np.stack(v) for k,v in allpred.items()}
    if any(m.shape!=(2,299,2,2) or not np.all(np.isfinite(m)) for m in pred.values()):
        raise ValueError('incomplete forecast')
    dest=argv.output/'forecasts.npz';np.savez_compressed(dest,**pred)
    info['forecast_sha256']=sha(dest)
    (argv.output/'source-diagnostics.json').write_text(json.dumps(info,sort_keys=True,allow_nan=False)+'\n')
    print('PREDICTION_LOCK',info['forecast_sha256'],'arms',len(pred),'raw_complex_predictions',sum(m.size for m in pred.values()),'target_values_read',0)


if __name__=='__main__':
    main()
