"""Forward realization of the author's RiderID model 5, restricted to source-run initializers."""
import numpy as np
from scipy.linalg import expm
from scipy.signal import oaconvolve
from weak_balance import C1,GRAVITY,H,K0,K2,M

def realization(v,parameters):
    k=np.asarray(parameters,dtype=float)
    if k.shape!=(4,):raise ValueError('role 5 uses positions 1,3,6,7')
    A=np.zeros((7,7))
    A[:2,:2]=-np.linalg.solve(M,C1*v)
    A[:2,2:4]=-np.linalg.solve(M,GRAVITY*K0+v*v*K2)
    A[2:4,:2]=np.eye(2)
    A[:2,5]=np.linalg.solve(M,[0.,1.])
    A[4,3]=1.
    A[5,6]=1.
    w=2*np.pi*2.17
    A[6,:]=w*w*np.array([k[1],k[3],k[0],0.,k[2],-1.,-np.sqrt(2)/w])
    b=np.zeros(7);b[:2]=np.linalg.solve(M,H)
    return A,b

def impulse(v,parameters,fs,n):
    """FOH time response, with zero state and zero pre-time input."""
    A,b=realization(v,parameters)
    h=1/fs
    U=np.zeros((9,9));U[:7,:7]=A;U[:7,7]=b;U[7,8]=1.
    ex=expm(U*h);F=ex[:7,:7];b1=ex[:7,8]/h;b0=ex[:7,7]-b1
    eigen,V=np.linalg.eig(F)
    if np.linalg.cond(V)>1e10:raise ValueError('unqualified modal conditioning')
    powers=np.power(eigen[:,None],np.arange(n)[None,:])
    def modes(z):
        return np.real((V[2:4,:]@((np.linalg.solve(V,z))[:,None]*powers)).T)
    # x[k+1]=F*x[k]+b0*u[k]+b1*u[k+1].
    # A bilateral convolution would assume u[-1]=0 but also let direct b1*u[0]
    # alter x[0]. Remove that transient to preserve zero initial state.
    g=modes(b0+F@b1)
    g=np.vstack([b1[2:4],g[:-1]])
    correction=modes(b1)
    return g,correction

def forecast(u,v,k,fs):
    g,correction=impulse(v,k,fs,len(u))
    result=np.column_stack([oaconvolve(u,g[:,i])[:len(u)] for i in range(2)])-u[0]*correction
    if not np.all(np.isfinite(result)):raise ValueError('nonfinite author-model realization')
    return result

def qualified_check():
    from scipy.signal import lsim,StateSpace
    v=4.;k=[34.,27.,180.,-3.];n=500;fs=200
    A,b=realization(v,k);C=np.eye(7)[2:4];t=np.arange(n)/fs
    u=.65+np.sin(.4*t)+.1*np.cos(5*t)
    _,direct,_=lsim(StateSpace(A,b[:,None],C,np.zeros((2,1))),u,t,interp=True)
    native=forecast(u,v,k,fs);error=np.max(np.abs(direct-native))
    assert error<1e-10
    return float(error)
if __name__=='__main__':print('FOH versus direct state-space absolute',qualified_check())
