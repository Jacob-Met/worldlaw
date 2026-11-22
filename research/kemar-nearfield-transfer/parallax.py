import numpy as np
from projective import unit_vectors, projective_loss

BINS = np.arange(3, 43)
LAMBDAS = (0.0001, 0.001, 0.01, 0.1)
FIT_ARMS = ("ear_local", "head_centered", "head_inverse_radius", "global_ear_gain")
ARMS = ("author_fem", "neighbor_measured", "neighbor_fem_residual", *FIT_ARMS)


def points(keys):
    az, el, mm = np.array(keys).T
    az, el = np.deg2rad(az), np.deg2rad(el)
    direction = np.column_stack((np.cos(az)*np.cos(el), np.sin(az)*np.cos(el), np.sin(el)))
    return direction, mm / 1000.


def basis(u):
    x, y, z = u.T
    return np.column_stack((np.ones(len(u)), x, y, z, x*y, x*z, y*z, x*x-y*y,
                            3*z*z-1, x*(x*x-3*y*y), y*(3*x*x-y*y), x*y*z,
                            z*(x*x-y*y), x*(5*z*z-1), y*(5*z*z-1), z*(5*z*z-3)))


def features(keys, arm):
    direction, r = points(keys)
    center = basis(direction)
    if arm == "global_ear_gain":
        center = center[:, :1]
    if arm == "head_inverse_radius":
        center = np.column_stack((center, center*(1/r[:, None]-1)))
    if arm != "ear_local":
        return center, center
    relative = []
    for offset in (0.09, -0.09):
        a = direction*r[:,None] - np.array([0.,offset,0.])
        relative.append(basis(a/np.linalg.norm(a,axis=1)[:,None]))
    return tuple(relative)


def fit(keys, observed, fem, arm, regularizers):
    left, right = features(keys, arm)
    y, y_good = unit_vectors(observed)
    f, f_good = unit_vectors(fem)
    all_fits = {lam: [] for lam in regularizers}
    for freq in range(y.shape[1]):
        valid = y_good[:,freq] & f_good[:,freq]
        if not np.any(valid):
            raise ValueError("empty calibration frequency")
        a = y[valid,freq,0] * f[valid,freq,1]
        b = -y[valid,freq,1] * f[valid,freq,0]
        design = np.column_stack((b[:,None]*left[valid],a[:,None]*right[valid]))
        target = -(a+b)
        gram = (design.conj().T @ design) / len(target)
        rhs = (design.conj().T @ target) / len(target)
        for lam in regularizers:
            all_fits[lam].append(np.linalg.solve(gram+lam*np.eye(len(rhs)),rhs))
    return {lam:np.asarray(v) for lam,v in all_fits.items()}


def apply(keys, fem, arm, coeffs):
    left, right = features(keys,arm)
    n = left.shape[1]
    gl = 1+left @ coeffs[:,:n].T
    gr = 1+right @ coeffs[:,n:].T
    return fem * np.stack((gl,gr),axis=-1)


def local_controls(train_keys, y, train_f, out_keys, out_f):
    td, tr = points(train_keys)
    od, rr = points(out_keys)
    normalized, _ = unit_vectors(y)
    quotient, _ = unit_vectors(np.stack((y[...,0]*train_f[...,1],y[...,1]*train_f[...,0]),axis=-1))
    predictions = [[],[]]
    for direction, radius, fem in zip(od,rr,out_f):
        # The closest available training shell. Stable tie break follows sorted coordinates.
        choice = np.isclose(abs(tr-radius),min(abs(tr-radius)),rtol=0,atol=1e-12)
        ids = np.flatnonzero(choice)
        angles = np.arccos(np.clip(td[ids] @ direction,-1.,1.))
        take = np.argsort(angles,kind="stable")[:8]
        weights = np.exp(-0.5*(angles[take]/np.deg2rad(7.5))**2)
        ids = ids[take]
        for output_index,bank in enumerate((normalized,quotient)):
            v=bank[ids]
            projectors=np.einsum("n,nfi,nfj->fij",weights,v,v.conj())
            eigenvalues, vectors=np.linalg.eigh(projectors)
            estimate=vectors[:,:,-1]
            estimate[eigenvalues[:,-1] == eigenvalues[:,0]] = 0
            predictions[output_index].append(estimate if output_index==0 else estimate*fem)
    return tuple(map(np.asarray,predictions))


def run(train_keys, y, fem, out_keys, out_fem):
    train_keys=np.asarray(train_keys)
    fit_mask=(train_keys[:,0]%20==0)&(train_keys[:,2]>=900)
    tune_mask=(train_keys[:,0]%20==10)&(train_keys[:,2]<=870)
    pred={"author_fem":out_fem}
    inner={}
    pred["neighbor_measured"],pred["neighbor_fem_residual"]=local_controls(train_keys,y,fem,out_keys,out_fem)
    for arm in FIT_ARMS:
        fits=fit(train_keys[fit_mask],y[fit_mask],fem[fit_mask],arm,LAMBDAS)
        scores=[]
        for lam in LAMBDAS:
            yhat=apply(train_keys[tune_mask],fem[tune_mask],arm,fits[lam])
            scores.append(float(np.nanmean(projective_loss(y[tune_mask],yhat))))
        chosen=LAMBDAS[int(np.argmin(scores))]
        inner[arm]={"selected":chosen,"loss":scores}
        final=fit(train_keys,y,fem,arm,[chosen])[chosen]
        pred[arm]=apply(out_keys,out_fem,arm,final)
    return pred,inner
