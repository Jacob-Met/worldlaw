"""Branch-free transfer-matrix predictors under fixed, two-sided error boxes."""
from itertools import combinations, combinations_with_replacement
import numpy as np


def from_s(s):
    """Hatab column-major chain convention, with port index in the last two axes."""
    t = s.copy()
    t[..., 0, 0] = s[..., 0, 1]*s[..., 1, 0] - s[..., 0, 0]*s[..., 1, 1]
    t[..., 0, 1] = s[..., 0, 0]
    t[..., 1, 0] = -s[..., 1, 1]
    t[..., 1, 1] = 1
    return t / s[..., 1, 0, None, None]


def from_t(t):
    s = t.copy()
    s[..., 0, 0] = t[..., 0, 1]
    s[..., 0, 1] = t[..., 0, 0]*t[..., 1, 1] - t[..., 0, 1]*t[..., 1, 0]
    s[..., 1, 0] = 1
    s[..., 1, 1] = -t[..., 1, 0]
    return s / t[..., 1, 1, None, None]


def dchain(s, ds):
    t = from_s(s)
    dn = np.zeros_like(ds)
    dn[..., 0, 0] = (ds[..., 0, 1]*s[..., 1, 0] + s[..., 0, 1]*ds[..., 1, 0]
                      - ds[..., 0, 0]*s[..., 1, 1] - s[..., 0, 0]*ds[..., 1, 1])
    dn[..., 0, 1] = ds[..., 0, 0]
    dn[..., 1, 0] = -ds[..., 1, 1]
    return (dn-t*ds[..., 1, 0, None, None]) / s[..., 1, 0, None, None]


def dscatter(t, dt):
    s = from_t(t)
    dn = np.zeros_like(dt)
    dn[..., 0, 0] = dt[..., 0, 1]
    dn[..., 0, 1] = (dt[..., 0, 0]*t[..., 1, 1] + t[..., 0, 0]*dt[..., 1, 1]
                      - dt[..., 0, 1]*t[..., 1, 0] - t[..., 0, 1]*dt[..., 1, 0])
    dn[..., 1, 1] = -dt[..., 1, 0]
    return (dn-s*dt[..., 1, 1, None, None]) / t[..., 1, 1, None, None]


def paths(lengths, target):
    return [(a,b,c) for a,c in combinations_with_replacement(sorted(lengths),2)
            for b in sorted(lengths) if a-b+c == target]


def simplex_minvar(covariance):
    """Enumerate nonempty faces; retain the minimum feasible quadratic variance."""
    n = len(covariance)
    unit = np.ones(n)/n
    scale = np.trace(covariance)/n
    if scale == 0:
        return unit
    if not np.isfinite(scale) or scale < 0:
        raise ValueError("invalid propagated variance")
    # The isotropic term is a numerical tie-breaker at double precision scale.
    cov = (covariance + covariance.T)/(2*scale) + 1e-12*np.eye(n)
    best, objective = unit, unit @ cov @ unit
    for k in range(1, n+1):
        for face in combinations(range(n), k):
            ix = np.array(face)
            precision_one = np.linalg.solve(cov[np.ix_(ix,ix)], np.ones(k))
            local = precision_one/precision_one.sum()
            if local.min() < -1e-10:
                continue
            w = np.zeros(n)
            w[ix] = np.maximum(local,0)
            w /= w.sum()
            value = w @ cov @ w
            if value < objective:
                best, objective = w,value
    return best


def predict(sweeps, target):
    """Map source half-mm IDs to arrays shaped (25, frequency, output port, input port)."""
    roster = paths(sweeps, target)
    means = {l:x.mean(axis=0) for l,x in sweeps.items()}
    chain = {l:from_s(s) for l,s in means.items()}
    inverse = {l:np.linalg.inv(t) for l,t in chain.items()}
    deviations = {l:dchain(means[l], x-means[l]) for l,x in sweeps.items()}
    base = []
    reversed_path = []
    influences = {l:[] for l in means}
    for a,b,c in roster:
        orientations = [(a,b,c),(c,b,a)]
        both = []
        derivs = {l:[] for l in means}
        for u,v,w in orientations:
            left,right = chain[u]@inverse[v], inverse[v]@chain[w]
            product = left@chain[w]
            both.append(from_t(product))
            for l in means:
                d = deviations[l]
                dt = np.zeros_like(d)
                if u == l:
                    dt += d@right
                if v == l:
                    dt -= left@d@right
                if w == l:
                    dt += left@d
                derivs[l].append(dscatter(product, dt))
        base.append((both[0]+both[1])/2)
        reversed_path.append(both[0]-both[1])
        for l in means:
            influences[l].append((derivs[l][0]+derivs[l][1])/2)
    base = np.array(base)
    nf = base.shape[1]
    cov = np.zeros((nf,len(roster),len(roster)))
    for l, columns in influences.items():
        e = np.asarray(columns)
        n = e.shape[1]
        cov += np.einsum('pnfij,qnfij->fpq',e.conj(),e,optimize=True).real/(n*(n-1))
    weights = np.array([simplex_minvar(c) for c in cov])
    optimal = np.einsum('fp,pfij->fij',weights,base)
    spread = np.max(np.linalg.norm(base-optimal,axis=(-2,-1)),axis=0)
    order = np.max(np.linalg.norm(reversed_path,axis=(-2,-1)),axis=0)
    std = np.sqrt(np.maximum(np.einsum('fp,fpq,fq->f',weights,cov,weights),0))
    return {'covariance_weighted':optimal,'equal_path':base.mean(axis=0),'paths':roster,
            'weights':weights,'order_disagreement':order,'path_spread':spread,'sweep_std':std}


def inversion_diagnostics(sweeps):
    diagnostics = {}
    for l, values in sweeps.items():
        t = from_s(values.mean(axis=0))
        perturb = np.linalg.norm(from_s(values)-t,ord=2,axis=(-2,-1)).max(axis=0)
        singular = np.linalg.svd(t,compute_uv=False)
        diagnostics[l] = {'condition':singular[:,0]/singular[:,1],
                          'min_singular':singular[:,1],
                          'sample_perturbation_ratio':perturb/singular[:,1]}
    return diagnostics
