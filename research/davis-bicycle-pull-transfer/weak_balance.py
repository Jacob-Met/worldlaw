"""Weak impulse-response balance from the released Davis bicycle roll equation."""
import numpy as np
from scipy.linalg import expm, solve_continuous_are

M = np.array([[133.31668525, 2.43885691], [2.43885691, .22419262]])
C1 = np.array([[0.,44.65783277],[-.31500940,1.46189246]])
K0 = np.array([[-116.73261635,-2.48042260],[-2.48042260,-.77434358]])
K2 = np.array([[0.,104.85805076],[0.,2.29688720]])
H = np.array([.91,.014408])
GRAVITY=9.81

def test_functions(t, centers, halfwidths):
    """Compact C3 test functions. They can cross the time-zero impulse."""
    w=np.broadcast_to(np.asarray(halfwidths,dtype=float),np.shape(centers))[:,None]
    z=(np.asarray(t)[None,:]-np.asarray(centers)[:,None])/w
    a=np.maximum(1-z*z,0.)
    return a**4, -8*z*a**3/w, (-8*a**3+48*z*z*a*a)/(w*w)

def balance_operator(t,basis,speed,centers,halfwidths,sham=False):
    """Local weak form for a continuous impulse response B(t) times coefficients."""
    t=np.asarray(t,dtype=float)
    if t[0]!=0 or np.any(np.diff(t)<=0):raise ValueError('physical impulse clock')
    if np.any(np.asarray(centers)+np.asarray(halfwidths)>t[-1]):
        raise ValueError('all tests must end within the kernel support')
    phi,dp,ddp=test_functions(t,centers,halfwidths)
    quad=np.empty_like(t)
    quad[1:-1]=(t[2:]-t[:-2])/2
    quad[0]=(t[1]-t[0])/2
    quad[-1]=(t[-1]-t[-2])/2
    wc=(phi*quad)@basis
    wd=(dp*quad)@basis
    wa=(ddp*quad)@basis
    stiffness=GRAVITY*K0+speed**2*K2
    cols=[M[0,j]*wa-speed*C1[0,j]*wd+stiffness[0,j]*wc for j in range(2)]
    if sham:cols[1]=-cols[1]
    return np.hstack(cols),H[0]*phi[:,0]

def synthetic_plant(speed,dt,total=3.):
    """Generate a stable feedback example without consulting experimental channels."""
    stiff=GRAVITY*K0+speed**2*K2
    A=np.block([[-np.linalg.solve(M,C1)*speed,-np.linalg.solve(M,stiff)],
                [np.eye(2),np.zeros((2,2))]])
    bu=np.r_[np.linalg.solve(M,[0.,1.]),[0.,0.]][:,None]
    bp=np.r_[np.linalg.solve(M,H),[0.,0.]]
    P=solve_continuous_are(A,bu,np.diag([2.,2.,10.,4.]),np.eye(1))
    step=expm((A-bu@bu.T@P)*dt)
    t=np.arange(round(total/dt)+1)*dt
    states=np.empty((len(t),4));states[0]=bp
    for i in range(1,len(t)):states[i]=step@states[i-1]
    return t,states[:,2:]

def synthetic_check():
    centers=np.array([0.,.04,.11,.35,.8,1.3,1.8])
    w=np.array([.14,.14,.18,.2,.34,.5,.6])
    rows=[]
    for speed in (2.,4.,7.):
        errors=[]
        for dt in (.002,.001,.0005):
            t,h=synthetic_plant(speed,dt)
            # Use the two exact impulse responses themselves as evaluation basis.
            L,b=balance_operator(t,h,speed,centers,w)
            theta=np.array([1.,0.,0.,1.]);e=np.max(np.abs(L@theta-b))
            Ls,_=balance_operator(t,h,speed,centers,w,True)
            errors.append((float(e),float(np.max(abs(Ls@theta-b)))))
        assert errors[-1][0]<2e-4 and errors[-1][0]<.1*errors[0][0]
        assert errors[-1][1]>100*errors[-1][0]
        rows.append([speed,errors])
    return rows
if __name__=='__main__':print(synthetic_check())
