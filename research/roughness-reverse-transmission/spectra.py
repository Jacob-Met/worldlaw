"""Direction-reversal spectrum estimators. Arrays are released intensity in arbitrary units."""
import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.linalg import cho_factor, cho_solve
from scipy.spatial.distance import cdist


def rms(x):
    return float(np.sqrt(np.mean(np.square(x))))


def smooth(x, width):
    return gaussian_filter1d(x, width, axis=0, mode='nearest')


def pair_inputs(a):
    # Only columns 0/90/270 degrees are present in a.
    scale=rms(a[:,0])
    if scale<=0 or not np.isfinite(a).all():
        raise ValueError('Zero-power forward input or nonfinite values')
    return a/scale,scale


def compose_features(s, frequency, inp):
    x,scale=pair_inputs(inp)
    u=(frequency-500.)/180.
    fwd=x[:,0];even=(x[:,1]+x[:,2])/2;odd=x[:,2]-x[:,1]
    return np.column_stack([u,np.full(len(x),np.log(s)/3),
        np.arcsinh(fwd),np.arcsinh(even),np.arcsinh(odd),np.arcsinh(6*np.gradient(smooth(fwd,2))),
        np.arcsinh(6*np.gradient(smooth(even,2))),np.arcsinh(smooth(fwd,14)),
        np.arcsinh(smooth(odd,14))])


def donor(s, levels):
    levels=np.asarray(sorted(levels))
    if not levels[0] < s < levels[-1]:
        raise ValueError('Registered course requires bracketing donors')
    i=np.searchsorted(levels,s)
    lo,hi=levels[i-1:i+1]
    frac=(np.log(s)-np.log(lo))/(np.log(hi)-np.log(lo))
    return ((float(lo),1-frac),(float(hi),frac))


def local_operator(source, reverse):
    x,scale=pair_inputs(source);a=x[:,0];d=6*np.gradient(smooth(a,2))
    y=(reverse-source[:,0])/scale
    aa=smooth(a*a,18)+.006
    dd=smooth(d*d,18)+.012
    ad=smooth(a*d,18);ay=smooth(a*y,18);dy=smooth(d*y,18)
    det=aa*dd-ad*ad
    return np.column_stack([(dd*ay-ad*dy)/det, (aa*dy-ad*ay)/det])


def shapes(a):
    p=[a[:,0],(a[:,1]+a[:,2])/2]
    return np.column_stack([np.arcsinh(smooth(v,3)/max(rms(v)*.30,1e-15)) for v in p])


def warp(target, source):
    t,s=shapes(target),shapes(source)
    n=len(t)
    if len(s)!=n:
        raise ValueError('common frequency grid required')
    costs=cdist(t,s,'sqeuclidean')/t.shape[1]
    previous=np.full(n,np.inf);back=np.full((n,n),-1,np.int8)
    band=min(160,n-1)
    for i in range(n):
        row=np.full(n,np.inf)
        for j in range(max(0,i-band),min(n,i+band+1)):
            if i==j==0:
                row[j]=costs[i,j];continue
            cdiag=previous[j-1] if j else np.inf
            cup=previous[j]+.07
            cleft=row[j-1]+.07 if j else np.inf
            k=0 if cdiag<=cup and cdiag<=cleft else (1 if cup<=cleft else 2)
            row[j]=costs[i,j]+.15*((i-j)/max(1,band))**2+(cdiag,cup,cleft)[k]
            back[i,j]=k
        previous=row
    i=j=n-1;buckets=[[] for _ in range(n)]
    while True:
        buckets[i].append(j)
        if i==j==0:break
        step=back[i,j]
        if step<0:raise ValueError('registered warp disconnected')
        if step!=2:i-=1
        if step!=1:j-=1
    return np.asarray([np.mean(v) for v in buckets])


def fitted_kernel_prediction(train, s, freq, inp):
    X=np.vstack([compose_features(q,freq,obs) for q,(obs,_) in sorted(train.items())])
    y=np.concatenate([(target-obs[:,0])/rms(obs[:,0]) for _,(obs,target) in sorted(train.items())])
    sd=np.maximum(X.std(axis=0),.15);X/=sd
    q=compose_features(s,freq,inp)/sd
    gram=np.exp(-cdist(X,X,'sqeuclidean')/(2*2.2**2))
    gram.flat[::len(gram)+1]+=.12
    beta=cho_solve(cho_factor(gram,lower=True,check_finite=False),y,check_finite=False)
    return inp[:,0]+rms(inp[:,0])*(np.exp(-cdist(q,X,'sqeuclidean')/(2*2.2**2))@beta)


def predict(train,s,freq,inp):
    x,scale=pair_inputs(inp);a=x[:,0];d=6*np.gradient(smooth(a,2))
    if not np.allclose(np.diff(freq),.8,atol=1e-8,rtol=0):
        raise ValueError('source frequency layout changed')
    close=donor(s,train)
    ref,rev=train[min(train)]
    def calibrated(src,out,window):
        strength=rms(src)**2*.0001
        return smooth(src*(out-src),window)/(smooth(src*src,window)+strength)
    ans={'equal':inp[:,0].copy(),
         'smooth_reference':inp[:,0]*(1+calibrated(ref[:,0],rev,8)),
         'transverse_gain':inp[:,0]*(1+calibrated(inp[:,1],inp[:,2],8)),
         'transverse_additive':inp[:,0]+inp[:,2]-inp[:,1]}
    # Estimate a shared gain and additive recording offset independently of
    # the held reverse spectrum. Normalize each apparatus run by its forward RMS.
    xx=[];yy=[]
    for _,(obs,out) in sorted(train.items()):
        fac=rms(obs[:,0])
        xx.extend([obs[:,0]/fac,obs[:,1]/fac])
        yy.extend([(out-obs[:,0])/fac,(obs[:,2]-obs[:,1])/fac])
    xx.append(x[:,1]);yy.append(x[:,2]-x[:,1])
    xx=np.asarray(xx);yy=np.asarray(yy)
    meanx=smooth(xx.mean(axis=0),6);meany=smooth(yy.mean(axis=0),6)
    variance=np.maximum(0.,smooth((xx*xx).mean(axis=0),6)-meanx**2)
    covariance=smooth((xx*yy).mean(axis=0),6)-meanx*meany
    gain=covariance/(variance+.008)
    ans['cross_level_affine']=inp[:,0]+scale*(meany+gain*(a-meanx))
    u=x[:,1];v=x[:,2]-u
    mu=smooth(u,10);mv=smooth(v,10)
    gain=(smooth(u*v,10)-mu*mv)/(np.maximum(0.,smooth(u*u,10)-mu*mu)+.008)
    ans['local_transverse_affine']=inp[:,0]+scale*(mv+gain*(a-mu))
    # Exact same-bin transverse ratio is allowed only when all denominators are nonzero.
    # The registered alternative in event of an exact zero is the identity for that bin.
    direct=inp[:,0].copy()
    np.divide(inp[:,0]*inp[:,2],inp[:,1],out=direct,where=inp[:,1]!=0)
    ans['transverse_ratio']=direct
    residual=np.zeros(len(a));plain=np.zeros((len(a),2));moving=plain.copy();diagnostics={};individual=[]
    for k,w in close:
        z,y=train[k];residual+=w*(y-z[:,0])/rms(z[:,0])
        c=local_operator(z,y);plain+=w*c
        idx=warp(inp,z);new=np.column_stack([np.interp(idx,np.arange(len(a)),v) for v in c.T])
        moving+=w*new
        individual.append(inp[:,0]+scale*(new[:,0]*a+new[:,1]*d))
        diagnostics[str(k)]={'weight':float(w),'median_abs_warp_bins':float(np.median(abs(idx-np.arange(len(a))))),
                             'max_abs_warp_bins':float(np.max(abs(idx-np.arange(len(a)))))}
    ans['donor_difference']=inp[:,0]+scale*residual
    ans['fixed_frequency_operator']=inp[:,0]+scale*(plain[:,0]*a+plain[:,1]*d)
    ans['registered_operator']=inp[:,0]+scale*(moving[:,0]*a+moving[:,1]*d)
    ans['donor_consensus']=np.clip(ans['smooth_reference'],np.minimum(*individual),np.maximum(*individual))
    ans['nonlinear_kernel']=fitted_kernel_prediction(train,s,freq,inp)
    if not all(np.isfinite(v).all() and v.shape==(len(freq),) for v in ans.values()):
        raise ValueError('invalid forecast vector')
    return ans,diagnostics
