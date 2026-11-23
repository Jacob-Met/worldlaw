"""Training-only complex ridge selection with entire x columns held out."""
import numpy as np

RIDGES=np.array([1e-6,1e-4,1e-2,1e-1,1.0])

def fit_ridge(X,y,penalty):
    gram=X.conj().T@X
    scale=gram.trace().real/X.shape[1]
    if not np.isfinite(scale) or scale<=0:
        raise ValueError("Empty training excitation")
    return np.linalg.solve(gram+penalty*scale*np.eye(X.shape[1]),X.conj().T@y)

def choose_ridge(X,y,columns):
    folds=np.unique(columns)
    assert len(folds)==7
    errors=[]
    for penalty in RIDGES:
        error=0
        for column in folds:
            test=columns==column
            beta=fit_ridge(X[~test],y[~test],penalty)
            error+=np.vdot(X[test]@beta-y[test],X[test]@beta-y[test]).real
        errors.append(float(error))
    index=int(np.argmin(errors))
    return fit_ridge(X,y,RIDGES[index]),dict(grid=RIDGES.tolist(),sse=errors,selected=float(RIDGES[index]))
