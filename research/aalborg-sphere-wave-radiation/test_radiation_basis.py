"""Synthetic qualification for the exact supported motion and lag operators."""
import numpy as np
from radiation_fit import RADIUS, MEMORY_ROWS, basis_cache, matrix, lag_basis

def main():
    n=3025
    ix=np.arange(n)
    z=RADIUS*1.3*np.sin(ix*.014)
    s=np.clip(z/RADIUS,-1,1)
    cap=s-s**3/3
    h=np.clip(RADIUS-z,0,2*RADIUS)
    v=np.pi*h*h*(RADIUS-h/3)
    poly=(2*np.pi*RADIUS**3/3-v)/(np.pi*RADIUS**3)
    np.testing.assert_allclose(cap,poly,rtol=0,atol=1e-15)
    for step in [40,80]:
        x=basis_cache(z,step)
        tied=matrix(x,'cap_tied')
        np.testing.assert_allclose(tied,lag_basis(np.diff(cap,prepend=cap[0]),step),atol=2e-15)
        impulse=np.zeros(n);impulse[0]=1
        y=lag_basis(impulse,step)
        for col,center in enumerate(range(0,MEMORY_ROWS+1,step)):
            weight=np.maximum(0,1-np.abs(ix-center)/step)
            weight[ix>MEMORY_ROWS]=0
            np.testing.assert_allclose(y[:,col],weight)
        changed=z.copy();changed[1281:]*=-.7
        np.testing.assert_array_equal(tied[:1281],matrix(basis_cache(changed,step),'cap_tied')[:1281])
        assert np.count_nonzero(tied[0])==0
    print('Exact globally clipped volume polynomial, both native lag bases, causal future perturbation and no initial release impulse passed.')
if __name__=='__main__':
    main()
