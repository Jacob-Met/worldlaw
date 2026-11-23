"""Independent synthetic equivalence, derivative, and chart-removability controls."""
import json
import numpy as np
from matrix_paths import from_s,from_t,predict as original
from projective import compose, derivative,predict


def main():
    rng=np.random.default_rng(4149)
    z=lambda s:rng.normal(size=s)+1j*rng.normal(size=s)
    a,b,c=[z((29,2,2)) for _ in range(3)]
    h=1e-6
    da,db,dc=[z(a.shape) for _ in range(3)]
    actual,_=compose(a,b,c)
    matrix=from_t(from_s(a)@np.linalg.solve(from_s(b),from_s(c)))
    exact=max(abs(actual-matrix).ravel())
    d=derivative(a,b,c,da,db,dc)
    fd=(compose(a+h*da,b+h*db,c+h*dc)[0]-compose(a-h*da,b-h*db,c-h*dc)[0])/(2*h)
    jac=float(np.max(abs(d-fd))/(1+np.max(abs(d))))
    assert exact<1e-10 and jac<1e-7
    a[0,1,0]=0
    extension,denom=compose(a[0],b[0],c[0])
    assert denom!=0 and np.isfinite(extension).all() and extension[1,0]==0
    ls=(0,1,3,4,6,10)
    sweeps={l:z((1,9,2,2))+1e-3*z((25,9,2,2)) for l in ls}
    ep=es=0.
    for target in (2,13):
        u,v=original(sweeps,target),predict(sweeps,target)
        ep=max(ep,float(np.max(abs(u['covariance_weighted']-v['covariance_weighted']))))
        es=max(es,float(np.max(abs(u['sweep_std']-v['sweep_std']))))
    assert ep<1e-8 and es<1e-8
    print(json.dumps({'entries_compared':actual.size,'raw_S_equivalence':float(exact),
            'relative_jacobian_error':jac,'identical_weighted_forecasts_max_difference':ep,
            'sweep_noise_prediction_difference':es,'zero_constituent_transmission_finite':True,
            'held_wave_values_read':0}))


if __name__=='__main__':main()
