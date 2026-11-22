"""Frozen conditional pressure and first-passage models for the switched ZeMA accumulators."""
from itertools import combinations

import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.linalg import cho_factor, cho_solve
from scipy.ndimage import gaussian_filter1d

ATM_BAR=1.01325
VOLUME_LITRES=0.6
RATE=100.
LAST=1.50
LEVELS=(90,100,130)
ARMS=("source_volume_lower_anchor","lower_anchor_only","source_affine","source_pchip",
      "source_quadratic","conditional_kernel","gas_coordinate_interpolation")
KERNEL=(96.,.3,.01)


def stored_oil(pressure, precharge, exponent):
    absolute = np.asarray(pressure) + ATM_BAR
    if np.any(absolute <= 0):
        raise ValueError("Nonpositive absolute pressure")
    ratio = (precharge + ATM_BAR) / absolute
    return VOLUME_LITRES * np.maximum(0.0, 1.0 - ratio ** (1.0 / exponent))

def coordinate(pressure, precharge, exponent, circuit_compliance):
    return circuit_compliance * np.asarray(pressure) + stored_oil(pressure, precharge, exponent)

def inverse(volume, precharge, exponent, circuit_compliance):
    """The positive line-compliance term gives a strictly increasing inverse."""
    if circuit_compliance <= 0:
        raise ValueError("Positive effective circuit compliance required")
    quantity = np.asarray(volume)
    low = np.full(quantity.shape, -ATM_BAR + 1e-6)
    high = np.maximum(250.0, quantity / circuit_compliance + 1.0)
    if np.any(coordinate(low, precharge, exponent, circuit_compliance) > quantity):
        raise ValueError("Effective volume is outside the positive-pressure domain")
    for _ in range(48):
        mid = (low + high) / 2.0
        below = coordinate(mid, precharge, exponent, circuit_compliance) < quantity
        low = np.where(below, mid, low)
        high = np.where(below, high, mid)
    return (low + high) / 2.0

def blend(lower, upper, weight):
    return (1 - weight) * lower + weight * upper

def storage_interpolation(lower, upper, levels, target, exponent, compliance, anchor):
    lo, hi = levels
    weight = (target - lo) / (hi - lo)
    v_lo = coordinate(lower, lo, exponent, compliance)
    v_hi = coordinate(upper, hi, exponent, compliance)
    origin = blend(lower[...,anchor], upper[...,anchor], weight)
    start = coordinate(origin, target, exponent, compliance)
    delta = blend(v_lo - v_lo[...,anchor,None], v_hi - v_hi[...,anchor,None], weight)
    return inverse(start[...,None] + delta, target, exponent, compliance)

def groups_in(meta):
    return sorted(set(map(tuple,meta[:,:3])))

def transfer(templates, targets, penalty):
    # Center each bank, then interpolate on matching categorical main and pair effects.
    train = np.array(sorted(templates))
    signals = np.stack([templates[tuple(row)] for row in train])
    equality = targets[:, None, :] == train[None, :, :]
    self_equality = train[:, None, :] == train[None, :, :]
    def kernel(matches):
        scores = matches.sum(2).astype(float)
        scores += sum(matches[:,:,i] * matches[:,:,j] for i,j in combinations(range(3),2))
        return scores
    centered = signals - signals.mean(0)
    weights = np.linalg.solve(kernel(self_equality) + penalty*np.eye(len(train)),centered)
    result = signals.mean(0) + kernel(equality) @ weights
    # An empirically observed entire nuisance regime supplies its native template.
    for i,key in enumerate(map(tuple,targets)):
        if key in templates:
            result[i] = templates[key]
    return result

def registered(lo, hi, weight):
    """Displacement interpolation of the rise, with the residual shape retained."""
    rows = []
    for a,b in zip(lo,hi):
        time=np.arange(len(a))
        fractions=np.linspace(0,1,101)
        maps=[]
        for trace in (a,b):
            smooth=gaussian_filter1d(trace,2)
            monotone=np.maximum.accumulate(smooth)
            if monotone[-1]-monotone[0] < 0.1:
                maps.append(np.linspace(0,len(a)-1,len(fractions)))
            else:
                thresholds=monotone[0]+fractions*(monotone[-1]-monotone[0])
                knots=np.interp(thresholds,monotone,time)
                knots[0],knots[-1]=0,len(a)-1
                maps.append(knots)
        middle=(1-weight)*maps[0]+weight*maps[1]
        knots,positions=np.unique(middle,return_index=True)
        ta=np.interp(time,knots,maps[0][positions])
        tb=np.interp(time,knots,maps[1][positions])
        rows.append((1-weight)*np.interp(ta,time,a)+weight*np.interp(tb,time,b))
    return np.array(rows)

def predict(y,meta,levels,target,targets,penalty=0.25):
    endpoints=[]
    for level in levels:
        refs={}
        use=meta[:,3]==level
        for key in groups_in(meta[use]):
            matches=use & np.all(meta[:,:3]==key,axis=1)
            refs[key]=np.mean(y[matches],axis=0)
        endpoints.append(transfer(refs,targets,penalty))
    a,b=endpoints
    w=(target-levels[0])/(levels[1]-levels[0])
    arms={'pressure_linear':(1-w)*a+w*b,'arrival_registered':registered(a,b,w),'nearest':a if w<=0.5 else b}
    for exponent in (1.,1.2,1.4):
        for comp in (0.0001,0.0005,0.002,0.008):
            name=f'gas_n{exponent:g}_C{comp:g}'
            arms[name]=storage_interpolation(a,b,levels,target,exponent,comp,0)
    return arms

def model(y, meta, targets, target_bar, length, strength, ridge):
    # Each experimental condition contributes once, regardless of warm-up length.
    keys=sorted(set(map(tuple, meta[:,:4])))
    x=np.array(keys)
    means=np.stack([np.mean(y[np.all(meta[:,:4]==key,axis=1)],axis=0) for key in keys])
    trend=np.column_stack([np.ones(len(x)),(x[:,3]-110)/40])
    coef=np.linalg.lstsq(trend,means,rcond=None)[0]
    designs=np.column_stack([targets,np.full(len(targets),target_bar)])
    def cov(a,b):
        same=a[:,None,:3]==b[None,:,:3]
        nuisance=np.prod(1.0+strength*same,axis=2)
        delta=(a[:,None,3]-b[None,:,3])/length
        return nuisance*np.exp(-.5*delta**2)
    k=cov(x,x)
    weights=cho_solve(cho_factor(k+ridge*np.eye(len(x)),lower=True),means-trend@coef)
    return coef[0]+(target_bar-110)/40*coef[1]+cov(designs,x)@weights

def arms(y,m,targets,target,config=(96.,.3,.01)):
    plain=model(y,m,targets,target,*config)
    initial=plain[:,:1]
    values=coordinate(y,m[:,3,None],1.,.0001)
    delta=model(values-values[:,:1],m,targets,target,*config)
    vol=coordinate(initial,target,1.,.0001)+delta
    gas=inverse(vol,target,1.,.0001)
    # The exactly engaged isothermal gas without circuit compliance has an affine
    # coordinate in precharge times reciprocal absolute pressure. V0 cancels.
    reciprocal=(m[:,3,None]+ATM_BAR)/(y+ATM_BAR)
    dr=model(reciprocal-reciprocal[:,:1],m,targets,target,*config)
    zero=1/(1/(initial+ATM_BAR)+dr/(target+ATM_BAR))-ATM_BAR
    return {'kernel_pressure':plain,'kernel_isothermal_storage':gas,
            'kernel_weighted_reciprocal_C0':zero}

def predictions(y,meta,targets,kernel_parameters):
    predictions=predict(y,meta,(100,130),115,targets)
    keep=('pressure_linear','arrival_registered','gas_n1_C0.0001')
    predictions={k:predictions[k] for k in keep}
    banks=[]
    for p in LEVELS:
        present=meta[:,3]==p
        templates={key:y[present&np.all(meta[:,:3]==key,axis=1)].mean(axis=0)
                   for key in groups_in(meta[present])}
        banks.append(transfer(templates,targets,.25))
    banks=np.stack(banks)
    predictions['three_level_pchip']=PchipInterpolator(LEVELS,banks,axis=0)(115)
    weights=np.array([np.prod([(115-q)/(p-q) for q in LEVELS if q!=p]) for p in LEVELS])
    predictions['three_level_quadratic']=np.einsum('i,ijk->jk',weights,banks)
    predictions['functional_condition_kernel']=model(y,meta,targets,115,*kernel_parameters)
    # This arm charges the full PCHIP procedure equally for pressure and storage.
    vols=np.stack([coordinate(bank,p,1.,.0001) for p,bank in zip(LEVELS,banks)])
    target_start=predictions['three_level_pchip'][:,0]
    predicted_vol=PchipInterpolator(LEVELS,vols-vols[:,:,:1],axis=0)(115)
    predicted_vol+=coordinate(target_start,115,1.,.0001)[:,None]
    predictions['three_level_storage_pchip']=inverse(predicted_vol,115,1.,.0001)
    return predictions

def first_hit(trace,level):
    where=np.flatnonzero(trace>=level)
    if not len(where):
        return LAST,"right_boundary"
    j=where[0]
    if j==0:
        return 0.,"initially_above"
    return (j-1+(level-trace[j-1])/(trace[j]-trace[j-1]))/RATE,"observed"

def spans(y):
    out=[]
    status=[]
    for row in y:
        l,a=first_hit(row,155.)
        h,b=first_hit(row,180.)
        if h+1e-12 < l:
            raise ValueError("Invalid ordering of first passages")
        out.append(h-l)
        status.append((a,b))
    return np.array(out),status

def gas_litres(p):
    n=1.4
    atm=1.01325
    return .6*(p+atm)**(1/n)*((155.+atm)**(-1/n)-(180.+atm)**(-1/n))

def predict_transit(y,m,targets,levels,target):
    quantity,_=spans(y)
    support=[]
    for p in levels:
        mask=m[:,3]==p
        templates={key:quantity[mask&np.all(m[:,:3]==key,axis=1)].mean(keepdims=True) for key in groups_in(m[mask])}
        support.append(transfer(templates,targets,.25)[:,0])
    anchors=np.stack(support)
    i=max(j for j,p in enumerate(levels) if p<target)
    lo,hi=levels[i:i+2]
    w=(target-lo)/(hi-lo)
    weights=np.array([np.prod([(target-q)/(p-q) for q in levels if q!=p]) for p in levels])
    gasweight=(gas_litres(target)-gas_litres(lo))/(gas_litres(hi)-gas_litres(lo))
    answer={
        'source_volume_lower_anchor':anchors[i]+(gas_litres(target)-gas_litres(lo))/.125,
        'lower_anchor_only':anchors[i],
        'source_affine':(1-w)*anchors[i]+w*anchors[i+1],
        'source_pchip':PchipInterpolator(levels,anchors,axis=0)(target),
        'source_quadratic':weights@anchors,
        'conditional_kernel':model(quantity[:,None],m,targets,target,*KERNEL)[:,0],
        'gas_coordinate_interpolation':(1-gasweight)*anchors[i]+gasweight*anchors[i+1],
    }
    if tuple(answer)!=ARMS or any(not np.all(np.isfinite(x)) for x in answer.values()):
        raise ValueError("Invalid predicted vectors")
    return answer

def scores(predictions,target_cells,y,m,indices):
    truth,censor=spans(y)
    by_arm={}
    targets=list(map(tuple,target_cells))
    for name,bank in predictions.items():
        cells=[]
        for key,v in zip(targets,bank):
            loc=np.flatnonzero(np.all(m[:,:3]==key,axis=1))
            if not len(loc):
                continue
            actual=truth[loc]
            i=loc[np.argmax(abs(v-actual))]
            finite=np.array([censor[j]==('observed','observed') for j in loc])
            group=( [3,20,100].index(key[0])+[73,80,90,100].index(key[1])+int(key[2]))%3
            cells.append({'cell':list(map(int,key)),'novel':group==0,'pred':float(v),'mean_observed':float(actual.mean()),
                          'mean_of_complete_crossings':float(actual[finite].mean()) if finite.any() else None,
                          'complete':int(sum(finite)),'n':len(loc),'cell_bias':float(v-actual.mean()),
                          'trial_mae':float(np.mean(abs(v-actual))),'worst_id':int(indices[i]),
                          'worst_true':float(truth[i]),'worst_signed_error':float(v-truth[i]),
                          'worst_status':censor[i]})
        view={}
        for group in ('all','matched','novel'):
            bank2=[x for x in cells if group=='all' or x['novel']==(group=='novel')]
            if not bank2:continue
            worst=max(bank2,key=lambda x:abs(x['cell_bias']))
            view[group]={'cells':len(bank2),'cycles':sum(r['n'] for r in bank2),
                        'mean_abs_cell_bias':float(np.mean([abs(x['cell_bias']) for x in bank2])),
                        'worst_abs_cell_bias':abs(worst['cell_bias']),'worst_cell':worst['cell'],
                        'equal_cell_trial_mae':float(np.mean([x['trial_mae'] for x in bank2]))}
        by_arm[name]={'groups':view,'cells':cells}
    return by_arm,censor
