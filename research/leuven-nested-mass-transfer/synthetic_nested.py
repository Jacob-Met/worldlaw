"""Nonreciprocal readout gains atop one reciprocal, coupled, six-site physical matrix."""
import numpy as np
from subset_transfer import SETS,fit_gain

def check():
    rng=np.random.default_rng(104719)
    q=rng.normal(size=(13,13))+.12j*rng.normal(size=(13,13))
    g=q@q.T+10*np.eye(13)
    gsu=g[:7,7:];scales=np.array([.03,.04,.05,.06,.07,.08])
    positive=np.diag(1/scales)
    left=np.linspace(1.4,2.1,7)*np.exp(1j*np.linspace(-.20,.18,7))
    right=np.linspace(.8,1.7,7)*np.exp(1j*np.linspace(.12,-.11,7))
    site_gain=np.linspace(.7,1.3,6)*np.exp(1j*np.linspace(-.13,.10,6))
    true=left[:,None]*g[:7,:7]*right
    w,report=fit_gain(true)
    assert w is not None
    b=left[:,None]*gsu*site_gain
    def changed(chosen):
        cols=gsu[:,chosen]
        physical=cols@np.linalg.inv((positive-g[7:,7:])[np.ix_(chosen,chosen)])@cols.T
        return left[:,None]*physical*right
    full=changed(list(range(6)))
    delta=full[:6,:6]/w[:6]
    bi=np.linalg.inv(b[:6])
    t=bi@((delta+delta.T)/2)@bi.T
    errors=[]
    for ix in SETS:
        rem=[i for i in range(6) if i not in ix]
        core=t[np.ix_(ix,ix)]-t[np.ix_(ix,rem)]@np.linalg.solve(t[np.ix_(rem,rem)],t[np.ix_(rem,ix)])
        result=(b[:,ix]@core@b[:,ix].T)*w
        error=np.max(abs(result-changed(ix)))/np.max(abs(changed(ix)))
        errors.append(float(error))
    assert max(errors)<1e-10
    # Two scalar-source gain corrections and all four multi-site interventions.
    return errors

if __name__=='__main__':print(check())
