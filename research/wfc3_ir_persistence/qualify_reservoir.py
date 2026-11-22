import json
import pathlib
import numpy as np
from reservoir import RATES, FIT_TIMES, read_agamma, exact_curve, knot_weights, stimulus_rates, elapsed, charge, write_pulse, mass_released

DURATIONS=(349.232727,352.939514,499.231873,799.232788)
PRECISE_AGES=np.geomspace(*FIT_TIMES,129)

def main(p):
    params=read_agamma(pathlib.Path(p).read_bytes())
    x=params[1]
    probe=np.unique(np.r_[x,np.sqrt(x[1:]*x[:-1])])
    assert np.all(np.diff(x)>0)
    lims=[]
    per={}
    best=None
    for d in DURATIONS:
        rates=stimulus_rates(params,d,probe)
        cap=knot_weights(params,d).max(axis=1)
        lims.append(cap)
        out=rates.T@np.exp(-RATES[:,None]*PRECISE_AGES)
        ref=np.stack([exact_curve(params,d,t,probe) for t in PRECISE_AGES],axis=1)
        ratio=np.abs(out-ref)/np.maximum(np.abs(ref),1e-15)
        ii,jj=np.unravel_index(np.argmax(ratio),ratio.shape)
        q=charge(rates)
        qi=int(np.argmax(q/probe))
        row={'max_abs_rate_error_e_s':float(np.max(np.abs(out-ref))),'max_relative_rate_error':float(ratio[ii,jj]),'worst_fluence_e':float(probe[ii]),'worst_age_s':float(PRECISE_AGES[jj]),'worst_ref_e_s':float(ref[ii,jj]),'worst_quadrature_e_s':float(out[ii,jj]),'maximum_stored_fraction':float(q[qi]/probe[qi]),'worst_charge_fluence_e':float(probe[qi]),'worst_charge_e':float(q[qi]),'min_rate':float(rates.min())}
        per[str(d)]=row
        if best is None or row['max_relative_rate_error']>best['max_relative_rate_error']:best=row
    cap=np.max(lims,axis=0)
    r=stimulus_rates(params,DURATIONS[0],probe)
    zero=np.zeros_like(r)
    half=write_pulse(zero,r,cap)
    assert np.array_equal(half,r) and np.array_equal(write_pulse(r,zero,cap),r)
    later=elapsed(r,349.233)
    nexts=write_pulse(later,r,cap)
    assert np.all(nexts>=later) and np.all(nexts<=cap[:,None]*(1+1e-12)) and np.all(nexts-later<=r*(1+1e-12))
    lhs=charge(r);rhs=mass_released(r,86400.)+charge(elapsed(r,86400.))
    mass_error=float(np.max(np.abs(lhs-rhs)/np.maximum(lhs,1e-300)))
    assert np.array_equal(stimulus_rates(params,DURATIONS[1],np.array([0.,x[0]-1,x[-1]+1])),np.zeros((len(RATES),3)))
    gate=best['max_relative_rate_error']<=0.005 and max(v['maximum_stored_fraction'] for v in per.values())<=1 and mass_error<1e-12
    print(json.dumps({'passed':bool(gate),'table_count':len(x),'fluence_probes':len(probe),'ages':len(PRECISE_AGES),'modes':len(RATES),'worst':best,'per_duration':per,'charge_conservation_relative_86400s':mass_error,'base_mode_capacity_charge_sum_e':float(np.sum(cap/RATES)),'pure_model_e_s':'pre-spatial-correction'},sort_keys=True))
if __name__=='__main__':
    import sys
    main(sys.argv[1])
