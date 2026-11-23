"""Componentwise perturbation bounds for the registered five-gauge figure test."""
import math

import numpy as np

from geometry import G, SCALE, PIVOT, POSITIONS, matrix, modes


def k_fixed_depth(omega, depth):
    lo, hi = 0., 1.
    for _ in range(120):
        m = (lo + hi)/2
        if G*m*math.tanh(depth*m) < omega**2:
            lo = m
        else:
            hi = m
    return (lo+hi)/2


def wave_intervals(ts, tl, time_tol, depth_tol, parent_shift):
    lo_depth, hi_depth = 250-depth_tol, 250+depth_tol
    w2 = [2*math.pi/(ts+time_tol), 2*math.pi/(ts-time_tol)]
    w1 = [2*math.pi/(tl+time_tol), 2*math.pi/(tl-time_tol)]
    def bounds(w, extra):
        return [k_fixed_depth(w[0], hi_depth)*(1-extra),
                k_fixed_depth(w[1], lo_depth)*(1+extra)]
    k2 = bounds(w2, parent_shift)
    k1 = bounds(w1, parent_shift)
    free = bounds([w2[0]-w1[1],w2[1]-w1[0]], 0.)
    bound = [k2[0]-k1[1], k2[1]-k1[0]]
    cross = [k2[0]+k1[0], k2[1]+k1[1]]
    both = []
    for pair in (bound, free, cross):
        both.extend([pair,[-pair[1],-pair[0]]])
    return np.array(both)


def bound(y, dx_model, time_tol, depth_tol, parent_shift, box=None):
    """A uniform lower bound on complex gauge error for the stated input boxes.

    The matrix inequalities are exact over reals; reported numerical bounds use
    float64. The test's strict slack is reported, not outward-rounded certification.
    """
    x = (np.array(POSITIONS["center"])-PIVOT)*SCALE
    k = modes(10.54,11.85)
    intervals = wave_intervals(10.54,11.85,time_tol,depth_tol,parent_shift)
    if box is not None:
        intervals = np.array(box)
        k = np.mean(intervals,axis=1)
    A = matrix(x,k).conj()
    keep = [0,2,3,4,5]
    inverse = np.linalg.inv(A[:,keep])
    u = inverse @ A[:,1]
    b = inverse @ y
    dk = np.max(np.abs(intervals-k[:,None]),axis=1)
    delta = np.minimum(2., np.abs(x[:,None])*dk + dx_model*SCALE*(np.abs(k)+dk))
    # Table 4 rounds R_low=.001 and R_high=.029 to one tenth of a percent.
    rho = .0015*.0295
    ell = .0015/.0285
    absinv = np.abs(inverse)
    gain = absinv.sum(axis=1)
    M = absinv @ delta[:,keep]
    M[:,0] += rho*(np.abs(u) + absinv @ delta[:,1])
    spectral = float(max(np.abs(np.linalg.eigvals(M))))
    result = {"dx_model_m":dx_model,"period_tolerance_s":time_tol,"depth_tolerance_m":depth_tol,
              "relative_parent_wavenumber_shift":parent_shift,"absolute_k_bounds":intervals.tolist(),
              "spectral_radius_of_majorant":spectral,"ratio_upper":ell,"product_upper":rho}
    if spectral >= 1:
        result["required_gauge_error_lower_m"] = None
        return result
    # Nonnegative W with an explicit strict supersolution, rather than
    # relying only on a numerical eigenvalue comparison for inverse positivity.
    witness = np.linalg.solve(np.eye(5)-M,np.ones(5))
    slack = float(np.min(witness-M@witness))
    if min(witness) <= 0 or slack < .99:
        raise ArithmeticError("Failed positive strict contraction witness")
    s0 = np.linalg.solve(np.eye(5)-M,np.abs(b))
    s1 = np.linalg.solve(np.eye(5)-M,gain)
    loss0 = M@s0
    loss1 = M@s1+gain
    excess = abs(b[3])-ell*abs(b[4])-loss0[3]-ell*loss0[4]
    eps = max(0.,excess)/(loss1[3]+ell*loss1[4])
    result.update({"positive_witness_min":float(min(witness)),"positive_witness_slack":slack,
                   "required_gauge_error_lower_m":float(eps)})
    return result

def parent_box_inventory(y, subdivisions):
    from itertools import product
    ts, tl = 10.54, 11.85
    dt, dh, change = .005,.025,.015
    def endpoints(t):
        return np.linspace(k_fixed_depth(2*math.pi/(t+dt),250+dh)*(1-change),
                           k_fixed_depth(2*math.pi/(t-dt),250-dh)*(1+change),
                           subdivisions+1)
    shorts,longs=endpoints(ts),endpoints(tl)
    free = wave_intervals(ts,tl,dt,dh,change)[2].tolist()
    cells = []
    for i,j in product(range(subdivisions),repeat=2):
        s1,s2=shorts[i:i+2]
        l1,l2=longs[j:j+2]
        box=[]
        for a,b in ((s1-l2,s2-l1),free,(s1+l1,s2+l2)):
            box.extend([[a,b],[-b,-a]])
        answer=bound(y,.0065,dt,dh,change,box=box)
        cells.append({"short_bin":i,"long_bin":j,
                      "spectral_radius":answer["spectral_radius_of_majorant"],
                      "lower_m":answer["required_gauge_error_lower_m"]})
    if any(c["lower_m"] is None for c in cells):
        lower = None
    else:
        lower = min(c["lower_m"] for c in cells)
    return {"subdivisions_per_parent":subdivisions,"complete_cover":True,
            "short_k_edges":shorts.tolist(),"long_k_edges":longs.tolist(),
            "free_k_interval":free,"cells":cells,"uniform_lower_m":lower}
