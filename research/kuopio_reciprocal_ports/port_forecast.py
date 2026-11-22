"""Predict fourteen later-listed current-pattern observations using sixty-two allowed columns."""
import numpy as np
from scipy.linalg import solve_sylvester


ROLE_NAMES = (
    "water", "raw_repeat", "reference_repeat", "reference_repeat_source_bias",
    "raw_superposition", "reference_superposition", "raw_reciprocal",
    "reference_reciprocal", "reference_reciprocal_gls",
    "reference_reciprocal_gls_wrong_electrode_order", "source_blend",
)


def split_drives(currents):
    grouped = {}
    train, query, donors = [], [], []
    for i, col in enumerate(currents.T):
        pair = tuple(np.flatnonzero(col))
        assert len(pair) == 2 and col[pair[0]] == -col[pair[1]]
        if pair in grouped:
            query.append(i)
            donors.append(grouped[pair])
        else:
            grouped[pair] = i
            train.append(i)
    assert len(train)==62 and len(query)==14 and set(train).isdisjoint(query)
    return np.array(train), np.array(query), np.array(donors)


def frame(currents, sensing, train, query):
    u, values, _ = np.linalg.svd(currents[:,train],full_matrices=False)
    u = u[:,values>1e-10]
    assert u.shape==(32,15) and np.linalg.matrix_rank(sensing)==31
    c = np.linalg.lstsq(sensing,u,rcond=None)[0]
    assert np.max(np.abs(sensing@c-u))<1e-12
    k = u.T@currents[:,train]
    query_k = u.T@currents[:,query]
    gram = k@k.T
    ev, evec = np.linalg.eigh(gram)
    h = (evec*(1/ev))@evec.T
    gi = (evec*np.sqrt(ev))@evec.T
    return c,k,query_k,h,gi


def regress(data, basis, noise, wrong=False):
    c,k,kq,h,gi = basis
    if wrong:
        # Keep the same number of linear and symmetry constraints; reverse only
        # the reported voltage-edge association, leaving currents unchanged.
        c=c[::-1]
    unconstrained=data@k.T@h
    power=c.T@unconstrained
    metric=gi@(c.T@noise@c)@gi
    skew=gi@(power-power.T)@gi
    multiplier=gi@solve_sylvester(metric,metric,skew)@gi
    x=unconstrained-noise@c@multiplier@h
    assert np.max(np.abs(c.T@x-(c.T@x).T))<1e-9
    return unconstrained@kq,x@kq


def partner_gain(currents,query,donor):
    return np.sum(currents[:,query]*currents[:,donor],axis=0)/np.sum(currents[:,donor]**2,axis=0)


def source_calibration(j,b,v0,v1):
    train,q,d=split_drives(j); gain=partner_gain(j,q,d)
    dev=v1-v0
    bias=dev[:,q]-gain*dev[:,d]
    # Fixed half-shrinkage to isotropic noise keeps the covariance full rank
    # with only fourteen distinct source acquisition-pair differences.
    cov=bias@bias.T/bias.shape[1]
    cov=.5*cov + .5*np.trace(cov)/cov.shape[0]*np.eye(cov.shape[0])
    assert np.min(np.linalg.eigvalsh(cov))>0
    basis=frame(j,b,train,q)
    _,rec=regress(dev[:,train],basis,cov)
    nearest=gain*dev[:,d]
    step=rec-nearest
    blend=float(np.clip(np.sum((dev[:,q]-nearest)*step)/np.sum(step**2),0,1))
    return cov,bias,blend


def predict(currents, sensing, water, admitted, configuration, source_current):
    train,q,d=split_drives(currents)
    assert admitted.shape==(31,len(train)) and water.shape==(31,76)
    assert np.array_equal(source_current,currents), "unmatched per-configuration currents"
    gain=partner_gain(currents,q,d)
    di=np.searchsorted(train,d)
    assert np.array_equal(train[di],d)
    basis=frame(currents,sensing,train,q)
    cov,bias,blend=configuration
    eye=np.eye(31)
    y0=water[:,q]
    delta=admitted-water[:,train]
    closest=delta[:,di]*gain
    raw_ols,raw_recip=regress(admitted,basis,eye)
    ols,recip=regress(delta,basis,eye)
    _,wrec=regress(delta,basis,cov)
    _,wrong=regress(delta,basis,cov,wrong=True)
    out=[y0,admitted[:,di]*gain,y0+closest,y0+closest+bias,raw_ols,y0+ols,
         raw_recip,y0+recip,y0+wrec,y0+wrong,y0+closest+blend*(wrec-closest)]
    assert all(a.shape==(31,14) and np.isfinite(a).all() for a in out)
    return dict(zip(ROLE_NAMES,out))
