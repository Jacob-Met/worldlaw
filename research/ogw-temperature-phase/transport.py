"""Local thermal phase transport of bank spectra, with matched Cartesian smoothers."""
import numpy as np
from baseline import fit_author_procedure


def project(waves, band):
    coeff=np.fft.rfft(waves,axis=-1)
    freq=np.fft.rfftfreq(waves.shape[-1],1e-7)
    lo,hi=band
    keep=(freq>=lo)&(freq<=hi)
    return np.fft.irfft(coeff*keep,n=waves.shape[-1],axis=-1)


def templates(bank, surface):
    """Fit 9-point local models in mean measured surface temperature on warm references only."""
    high=project(bank,(5000.,5e6))
    h=np.fft.rfft(high,axis=-1)
    fitted={k:np.empty_like(h) for k in ("average","quadratic","phase")}
    for i,center in enumerate(surface):
        near=np.sort(np.argsort(np.abs(surface-center),kind="stable")[:9])
        dt=surface[near]-center
        design=np.column_stack([np.ones(9),dt,dt**2])
        assert np.linalg.matrix_rank(design)==3
        weights=np.linalg.pinv(design)[0]
        z=h[near]
        powers=np.abs(z)**2
        factors=powers/(powers.sum(axis=0)+np.finfo(float).tiny)
        times=dt[:,None]
        tbar=(factors*times).sum(axis=0)
        p=np.unwrap(np.angle(z),axis=0)
        denom=(factors*(times-tbar)**2).sum(axis=0)
        numer=(factors*(times-tbar)*p).sum(axis=0)
        slope=np.divide(numer,denom,out=np.zeros_like(numer),where=denom>1e-15)
        fitted["average"][i]=np.mean(z,axis=0)
        fitted["quadratic"][i]=np.einsum("i,ij->j",weights,z)
        aligned=z*np.exp(-1j*slope[None,:]*times)
        fitted["phase"][i]=np.einsum("i,ij->j",weights,aligned)
    return {"observed":high,**{k:np.fft.irfft(v,n=bank.shape[-1],axis=-1) for k,v in fitted.items()}}


def segment(bank,y):
    """Closest point of every adjacent thermal bank segment in observed full-wave squared distance."""
    d=bank[1:]-bank[:-1]
    z=y[None,:]-bank[:-1]
    den=np.einsum("ij,ij->i",d,d)
    u=np.clip(np.divide(np.einsum("ij,ij->i",d,z),den,out=np.zeros_like(den),where=den>0),0.,1.)
    errors=z-u[:,None]*d
    i=int(np.argmin(np.einsum("ij,ij->i",errors,errors)))
    return bank[i]+u[i]*d[i],i,float(u[i])


def score_case(bank, banks, y):
    curves={}; params={}
    par,pieces=fit_author_procedure(bank,y,1e7,4e4)
    curves["raw_author"]=pieces[-1];params["raw_author"]=par
    yp=project(y,(5000.,5e6));low=y-yp
    # Realized low-band target fit is common to all these arms. It is not independent evidence.
    curves["offset_only"]=pieces[-1]+np.mean(y-pieces[-1])
    curves["low_band_only"]=low+project(pieces[-1],(5000.,5e6))
    par,parts=fit_author_procedure(banks["observed"],yp,1e7,4e4)
    curves["band_author"]=low+project(parts[-1],(5000.,5e6))
    params["band_author"]=par
    for method,refs in banks.items():
        initial,i,u=segment(refs,yp)
        par,parts=fit_author_procedure(initial[None,:],yp,1e7,4e4)
        params[method]={**par,"segment":i,"fraction":u}
        curves[method]=low+project(parts[-1],(5000.,5e6))
    result={}
    for method,curve in curves.items():
        e=curve-y
        rmse=lambda a:float(np.sqrt(np.mean(a**2)))
        result[method]={"raw":rmse(e),"above5k":rmse(project(e,(5000.,5e6))),
                        "carrier":rmse(project(e,(20000.,60000.))),"params":params.get(method,{})}
    return result,curves


if __name__=="__main__":
    n=1500;theta=np.linspace(20,60,81);t=np.arange(n)/n
    # An exactly on-bin rotating source coefficient with constant amplitude is preserved by de-rotation.
    x=np.cos(2*np.pi*8*t[None,:]+.30*(theta[:,None]-40.))
    b=templates(x,theta)
    assert np.max(np.abs(b["phase"]-x))<2e-12
    assert np.max(np.abs(b["quadratic"]-x))>1e-5
    assert np.max(np.abs(b["average"]-x))>.05
    y=.30*x[30]+.70*x[31];w,i,u=segment(x,y)
    assert i==30 and abs(u-.70)<1e-12 and np.max(np.abs(w-y))<1e-12
    y=x[40]+.1
    a,curves=score_case(x,b,y)
    assert a["phase"]["carrier"]<1e-13 and a["phase"]["raw"]<1e-12
    print("Known phase trajectory, curved Cartesian mismatch, fractional-bank recovery and offset cancellation passed")
