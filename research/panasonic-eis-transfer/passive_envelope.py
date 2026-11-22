"""Model-conditional, finite-spectrum Panasonic EIS-to-pulse envelopes (mOhm, A, s).

The nonnegative RC relaxation measure with series R,L is a model class.
An arbitrary passive impedance need not have this representation.
"""

import numpy as np
from scipy.optimize import lsq_linear, least_squares, linprog


def atoms(w, tau):
    return 1 / (1 + 1j * w[:, None] * tau)


def stack(z):
    return np.concatenate([z.real, z.imag], axis=0)


def fit_centres(w, z, tau):
    basis = np.column_stack([np.ones_like(w), 1j * w / max(w), atoms(w, tau)])
    scale = np.abs(z)
    design = stack(basis / scale[:, None])
    y = stack(z / scale)
    fit = lsq_linear(design, y, bounds=(0, np.inf), method="bvls", tol=1e-12)
    return fit.x, basis @ fit.x


def fit_models(w, z):
    tau = np.geomspace(1 / max(w), 1 / min(w), 80)
    weights, zhat = fit_centres(w, z, tau)
    out = {"DRT80": (tau, weights, zhat)}
    # Weighted quantile initialization follows a conventional log-time compression.
    # Constrained nonlinear refit gives all RC orders independent centre locations.
    mass = np.maximum(weights[2:], 0)
    cdf = np.cumsum(mass) / max(sum(mass), 1e-15)
    for n in range(1, 5):
        lt = np.log(tau)
        centres = np.interp((np.arange(n) + .5) / n, cdf, lt)
        c, _ = fit_centres(w, z, np.exp(centres))
        x0 = np.r_[np.maximum(c, 1e-6), centres]
        def residual(x):
            kernel = atoms(w, np.exp(x[n + 2:]))
            return stack((x[0] + 1j * x[1] * w / max(w) + kernel @ x[2:n+2] - z) / np.abs(z))
        opt = least_squares(residual, x0,
                            bounds=(np.r_[np.zeros(n+2), np.full(n, lt[0]-3)],
                                    np.r_[np.full(n+2, np.inf), np.full(n, lt[-1]+3)]),
                            max_nfev=600, ftol=1e-10, xtol=1e-10, gtol=1e-10)
        centre = np.exp(opt.x[n+2:])
        c, fitted = fit_centres(w, z, centre)
        out[f"ECM{n}"] = (centre, c, fitted)
    return out


def predict_point(tau, c, current, time, k):
    # Positive discharge. Left-hand end of the final ZOH interval. Series
    # inductance has no regular component inside an exactly flat interval.
    state = np.zeros(len(tau))
    for j in range(k):
        a = -np.expm1(-(time[j+1] - time[j]) / tau)
        state += a * (current[j] - state)
    return float(c[0] * current[k-1] + c[2:] @ state)


def cell_bounds(w, edges):
    lo, hi = edges[:-1], edges[1:]
    low, high = [], []
    for omega in w:
        def at(t, imag):
            v = np.zeros_like(t)
            f = np.isfinite(t)
            v[f] = (1+t[f]) / (1+(omega*t[f])**2)
            if imag:
                v[f] *= omega*t[f]
                v[~f] = 1/omega
            return v
        # Each transformed atom has one interior maximum, no interior minimum.
        peaks = [1 / (omega**2*(1+np.sqrt(1+1/omega**2))),
                 (1+np.sqrt(1+omega**2))/omega**2]
        pair = []
        for k, peak in enumerate(peaks):
            left, right = at(lo, k), at(hi, k)
            pair.append((np.minimum(left, right), at(np.clip(peak, lo, hi), k)))
        low.append([pair[0][0], -pair[1][1]])
        high.append([pair[0][1], -pair[1][0]])
    return np.concatenate(np.swapaxes(low,0,1),axis=0), np.concatenate(np.swapaxes(high,0,1),axis=0)


def step_bounds(t, edges):
    a,b = edges[:-1],edges[1:]
    with np.errstate(divide="ignore",invalid="ignore",over="ignore"):
        def phi(x):
            y = np.ones_like(x)
            np.divide(-np.expm1(-x),x,out=y,where=x!=0)
            return y
        s_a, s_b = -np.expm1(-t/a), -np.expm1(-t/b)
        lower = np.maximum((1+a)*s_b,(1+1/b)*t*phi(t/a))
        upper = np.minimum((1+b)*s_a,(1+1/a)*t*phi(t/b))
    return lower,upper


def relaxed_cone(w, z, tol, bins=640):
    # The first and last bins cover tau=0 through infinity, including both
    # compactified endpoints of dnu=dmu/(1+tau/(1 second)).
    edges = np.r_[0., np.geomspace(1e-9, 1e9, bins-1), np.inf]
    lo,hi = cell_bounds(w, edges)
    n=len(w)
    fixed = np.array([np.r_[np.ones(n),np.zeros(n)], np.r_[np.zeros(n),w/max(w)]]).T
    fuzz = 2e-11*(1+np.maximum(np.abs(lo),np.abs(hi)))
    A = np.r_[np.column_stack([fixed,lo-fuzz]),np.column_stack([-fixed,-hi-fuzz])]
    b = np.r_[stack(z)+tol,-stack(z)+tol]
    # Positive pricing functional bounds every nonnegative variable, including
    # inductance, the endpoint fast resistor and very slow relaxation mass.
    i,j,k = [int(np.argmin(abs(np.log(w/target)))) for target in (1.,8.,max(w))]
    positive = np.zeros(len(b))
    positive[i]=2
    positive[n+j]+=1/w[j]
    positive[3*n+i]+=1/w[i]
    positive[n+k]+=1
    prices=A.T@positive
    if min(prices)<=0:
        raise ArithmeticError("positive dual mass certificate unavailable")
    return edges,A,b,positive,prices


def upper_bound(A,b,c,positive,prices):
    p=linprog(-c, A_ub=A, b_ub=b, bounds=(0,None),method="highs")
    if not p.success:
        raise ArithmeticError(f"feasible-set LP failed: {p.message}")
    dual=np.maximum(-p.ineqlin.marginals,0)
    # Restore dual feasibility after the finite-precision solver. The guard
    # covers binary64 dot product accumulation and residual objective error.
    guard=1e-10*(1+np.abs(c)+np.abs(A).T@dual)
    correction=max(0.,float(np.max((c-A.T@dual+guard)/prices)))
    dual+=correction*positive
    gap=A.T@dual-c
    if np.min(gap)<0:
        raise ArithmeticError("adjusted dual infeasible")
    return float(b@dual+1e-9*(1+np.abs(b)@dual)),float(np.min(gap))


def envelope(cone, time, current, k, rest, initial_bound, pre_to_start):
    edges,A,b,pos,prices=cone
    h=time[k]-time[0]
    low,high=step_bounds(h, edges)
    with np.errstate(divide="ignore"):
        initial=initial_bound*np.exp(-rest/edges[1:])*step_bounds(h+pre_to_start,edges)[1]
    lower = np.r_[current[k-1],0.,min(current[:k])*low-initial]
    upper = np.r_[current[k-1],0.,max(current[:k])*high+initial]
    guard=1e-9*(1+np.maximum(abs(lower),abs(upper)))
    left,v1=upper_bound(A,b,-lower+guard,pos,prices)
    right,v2=upper_bound(A,b,upper+guard,pos,prices)
    return [-left,right],[v1,v2]
