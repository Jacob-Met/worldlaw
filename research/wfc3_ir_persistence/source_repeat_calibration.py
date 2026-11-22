"""Fit one finite-capacity multiplier using the nine published non-dithered repeat fits."""
import json
import pathlib
import numpy as np
from reservoir import RATES, read_agamma, stimulus_rates, knot_weights

# Long, Baggett & MacKenty, WFC3 ISR 2013-07, Table 1.
# A [e/s], x0 [e], delta [e], alpha, gamma. Visit's first digit is the pointing.
FITS = {
    "11": (.344,86738,18212,.144,1.019),
    "31": (.343,86516,17774,.146,1.021),
    "22": (.398,83663,18318,.137,.966),
    "13": (.389,84236,18874,.159,.952),
    "33": (.398,83627,19395,.151,.946),
    "24": (.395,85278,19424,.157,.945),
    "15": (.421,82011,19191,.153,.914),
    "35": (.437,80520,18872,.148,.904),
    "26": (.426,82116,19645,.152,.911),
}
FLUENCES = np.asarray([70_000.,100_000.,150_000.,200_000.])
AGES = np.asarray([200.,500.,1000.,2000.,4000.,6000.])
CAPS=np.geomspace(1.,32.,257)
SLACK=np.linspace(0.,1.,257)
DURATIONS=(349.232727,352.939514,499.231873,799.232788)


def fitted_curve(x,age,params):
    a,x0,delta,alpha,gamma=params
    return (a/(1+np.exp((x0-x)/delta))*(x/x0)**alpha)[:,None]*(age[None,:]/1000.)**(-gamma)


def candidates(params,times):
    cap=np.max([knot_weights(params,d).max(axis=1) for d in DURATIONS],axis=0)
    single=stimulus_rates(params,349.232727,FLUENCES)
    # dim(cap multiplier, release mode, calibration fluence).
    ceiling=CAPS[:,None,None]*cap[None,:,None]
    state=np.zeros((len(CAPS),len(cap),len(FLUENCES)))
    lin=np.zeros_like(single)
    last=0.
    for t in times:
        decay=np.exp(-RATES[:,None]*(t-last))
        state*=decay[None,:,:]
        lin*=decay
        state+=single[None,:,:]*(1-state/ceiling)
        lin+=single
        if np.any(state<0) or np.any(state>ceiling*(1+1e-12)):
            raise ValueError("Source capacity constraint violated")
        last=t
    lag=np.exp(-RATES[:,None]*AGES[None,:])
    denominator=single.T@lag
    ratio=np.einsum("kbf,bt->kft",state,lag,optimize=True)/denominator
    additive=(lin.T@lag)/denominator
    return ratio,1+SLACK[:,None,None]*(additive-1),additive


def choose(pred,truth,which):
    err=np.mean(np.stack([(np.log(pred[v])-np.log(truth[v]))**2 for v in which]),axis=(0,2,3))
    return int(np.argmin(err))


def rmse(pred,target):
    return float(np.sqrt(np.mean((np.log(pred)-np.log(target))**2)))


def main():
    params=read_agamma(pathlib.Path('PerCal-a_gamma.fits').read_bytes())
    schedule=json.loads(pathlib.Path('source-12694-actual-members.json').read_text())
    assert set(schedule['visits'])==set(FITS) and not schedule['mapping_errors'] and not schedule['header_errors']
    base=np.sqrt(fitted_curve(FLUENCES,AGES,FITS['11'])*fitted_curve(FLUENCES,AGES,FITS['31']))
    truth={};can={};shrink={};add={};spans={}
    for v,d in schedule['visits'].items():
        assert d['qualified'] and len(d['inputs'])==int(v[1])
        end=np.asarray([float(h['EXPEND']) for h in d['inputs']])
        assert np.all(np.diff(end)>0)
        times=(end-end[0])*86400
        spans[v]=times.tolist()
        can[v],shrink[v],add[v]=candidates(params,times)
        truth[v]=fitted_curve(FLUENCES,AGES,FITS[v])/base
    rows={}
    for v in sorted(FITS):
        train=[w for w in FITS if w[0]!=v[0]]
        ci=choose(can,truth,train)
        si=choose(shrink,truth,train)
        refn=np.array(sorted({int(w[1]) for w in train}))
        by_n=[np.mean([np.log(truth[w]) for w in train if int(w[1])==n],axis=0) for n in refn]
        axis=np.stack(by_n)
        predicted=np.array([np.interp(int(v[1]),refn,axis[:,f,t]) for f in range(len(FLUENCES)) for t in range(len(AGES))]).reshape(len(FLUENCES),len(AGES))
        pool={'capacity':can[v][ci],'published_repeat_shape':np.exp(predicted),'shrunken_sum':shrink[v][si],'maximum':np.ones_like(truth[v]),'sum':add[v]}
        raw=pool['capacity']/truth[v]
        f,t=np.unravel_index(int(np.argmax(abs(np.log(raw)))),raw.shape)
        rows[v]={'held_pointing':v[0],'repeats':int(v[1]),'fitted_C':float(CAPS[ci]),'fitted_shrink':float(SLACK[si]),'log_rmse':{k:rmse(p,truth[v]) for k,p in pool.items()},'worst':{'fluence_e':float(FLUENCES[f]),'age_s':float(AGES[t]),'published_ratio':float(truth[v][f,t]),'capacity_ratio':float(pool['capacity'][f,t]),'shrunken_sum_ratio':float(pool['shrunken_sum'][f,t]),'table_ratio':float(pool['published_repeat_shape'][f,t])}}
    avg={k:float(np.mean([row['log_rmse'][k] for row in rows.values()])) for k in rows['11']['log_rmse']}
    fcap=float(CAPS[choose(can,truth,list(FITS))]); fsh=float(SLACK[choose(shrink,truth,list(FITS))])
    gate=avg['capacity']<avg['maximum'] and avg['capacity']<avg['shrunken_sum']
    print(json.dumps({'source_contract':'Published fitted response-ratio surfaces, not raw 2012 darks. Two single-visit curves establish a common reference; leave-one-pointing-out is conditional on that published reference. Nine visit-equal errors.','source_gate':bool(gate),'mean_per_visit_log_rmse':avg,'full_source_capacity_multiplier':fcap,'full_source_shrink':fsh,'rows':rows,'source_pulse_end_times_relative_s':spans},sort_keys=True))

if __name__=='__main__':
    main()
