"""Exact scalar-gain envelope for one observed partial under a common real gain."""
import math


def shape_lower_bound(a,b,k):
    """Minimize |a[k]+g*b[k]| / max_j |a[j]+g*b[j]| over all g>=0."""
    # For each reference partial j, the squared ratio is a ratio of real
    # quadratics. Its global minimum is at an endpoint or a stationary root.
    # Taking the minimum over j and g commutes since the index set is finite.
    ak,bk=a[k],b[k];A=abs(ak)**2;B=(ak.conjugate()*bk).real;C=abs(bk)**2
    best=(1.,'identity',k+1)
    for j,(aj,bj) in enumerate(zip(a,b)):
        D,E,F=abs(aj)**2,(aj.conjugate()*bj).real,abs(bj)**2
        aa,bb,cc=C*E-B*F,C*D-A*F,B*D-A*E
        roots=[0.,math.inf]
        if aa:
            disc=bb*bb-4*aa*cc
            if disc>=0:
                disc=math.sqrt(disc);q=-.5*(bb+math.copysign(disc,bb))
                if q:roots.extend((q/aa,cc/q))
                else:roots.append(-bb/(2*aa))
        elif bb:roots.append(-cc/bb)
        for g in roots:
            if g<0:continue
            numer,denom=(abs(bk),abs(bj)) if math.isinf(g) else (abs(ak+g*bk),abs(aj+g*bj))
            if denom>0 and numer/denom<best[0]:best=(numer/denom,'infinity' if math.isinf(g) else g,j+1)
    return {'lower_amplitude_ratio':best[0],'lower_peak_normalized_dB':20*math.log10(max(best[0],.001)),'gain':best[1],'normalizing_mode':best[2]}


def dual_window(root):
    import json
    import numpy as np
    from pathlib import Path
    out={}
    for meter in ('early','stable'):
        d=Path(root)/'source'/meter
        X=np.load(d/'singles.npy');Y=np.load(d/'training-mixed.npy')
        a,b=X[1,0,1:3];meas=abs(Y[1,0,1]);bound=shape_lower_bound(a,b,5)
        z=-a[5]/b[5]
        bound.update(measured_dB=20*math.log10(max(meas[5]/max(meas),.001)),complex_gain_to_null=[float(z.real),float(z.imag)],
                     relative_phase_deg=float(np.rad2deg(np.angle(a[5]/b[5]))))
        out[meter]=bound
    return out


if __name__=='__main__':
    import argparse,json
    p=argparse.ArgumentParser();p.add_argument('root');q=p.parse_args()
    print(json.dumps(dual_window(q.root),sort_keys=True))
