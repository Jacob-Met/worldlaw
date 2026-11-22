"""Nonnegative constant-drive quadratic rotor flow and interval inverse."""
import numpy as np

def flow(state, drive, dt, drag):
    """Exact nonnegative solution of v' = drive - drag v² at constant drive."""
    v,a,t=np.broadcast_arrays(state,drive,dt)
    out=np.empty_like(v,dtype=np.float64)
    positive=a>0
    if positive.any():
        k=np.sqrt(drag*a[positive]);s=np.tanh(k*t[positive])/k
        out[positive]=(v[positive]+a[positive]*s)/(1+drag*v[positive]*s)
    zero=a==0
    out[zero]=v[zero]/(1+drag*v[zero]*t[zero])
    negative=a<0
    if negative.any():
        k=np.sqrt(-drag*a[negative]);theta=k*t[negative]
        moving=theta<np.arctan(drag*v[negative]/k)
        part=np.zeros_like(theta)
        s=np.tan(theta[moving])/k[moving]
        v0=v[negative][moving]
        part[moving]=(v0+a[negative][moving]*s)/(1+drag*v0*s)
        out[negative]=part
    return out


def interval_drive(start, end, dt, drag):
    """Return a constant drive that maps each strictly positive pair of endpoint speeds.

    Monotonicity bounds the mean squared speed between squared endpoints.
    Solving inside this bracket preserves the operating-point template.
    """
    if np.any(start<=0) or np.any(end<=0) or np.any(dt<=0):
        raise ValueError('the source interval inverse requires positive speeds and durations')
    derivative=(end-start)/dt
    left=derivative+drag*np.minimum(start,end)**2
    right=derivative+drag*np.maximum(start,end)**2
    for _ in range(45):
        mid=(left+right)/2
        below=flow(start,mid,dt,drag)<end
        left=np.where(below,mid,left)
        right=np.where(below,right,mid)
    drive=(left+right)/2
    if not np.allclose(flow(start,drive,dt,drag),end,atol=2.e-11,rtol=1.e-13):
        raise ValueError('source interval reconstruction')
    return drive
