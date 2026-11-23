"""Daily complex-pole response in the terrestrial frame and development-only nuisance fits."""
from datetime import date,timedelta
import math
import numpy as np

T,Q=434.2,179.0
YR=365.2425
OMEGA=2*math.pi/T
DT=np.exp((-OMEGA/(2*Q)+1j*OMEGA))
I=np.eye(2)
A,B,C=8.0100829,8.0102594,8.0364807
RATIO=math.sqrt(A*(C-A)/(B*(C-B)))

def transition(angle,ratio):
    l=math.radians(angle)
    axes=np.array([[math.cos(l),-math.sin(l)],[math.sin(l),math.cos(l)]])
    stretch=axes@np.diag([1.0,ratio])@axes.T
    rot=np.array([[DT.real,-DT.imag],[DT.imag,DT.real]])
    return stretch@rot@np.linalg.inv(stretch)

def basis(day):
    t=(day-date(2009,1,1)).days/YR
    return np.array([1,t,math.cos(2*math.pi*t),math.sin(2*math.pi*t)])

def integrate(year,origin,forcing,mat,modes=4):
    count=len(forcing)
    p=origin.copy();d=np.zeros((2,2*modes));daily=[];design=[]
    for i in range(count):
        phi=basis(date(year,1,1)+timedelta(days=i))[:modes]
        v=np.kron(I,phi)
        p=mat@p+(I-mat)@forcing[i]
        d=mat@d+(I-mat)@v
        daily.append(p);design.append(d)
    return np.array(daily),np.array(design)

def solve(inputs,training_truth):
    years=sorted(inputs)
    train=sorted(training_truth)
    means=[]
    forecasts={y:[] for y in years}
    for label,angle,ratio,modes,no_force in [
        ("triaxial",-14.928509,RATIO,4,False),("isotropic",0,1,4,False),
        ("sham",75.071491,RATIO,4,False),("offset_only",0,1,1,False),
        ("annual_free",0,1,4,True)]:
        mat=transition(angle,ratio)
        base={};design={}
        for y in years:
            anchor,forcing=inputs[y]
            base[y],design[y]=integrate(y,anchor,np.zeros_like(forcing) if no_force else forcing,mat,modes)
        xx=np.concatenate([design[y].reshape(-1,2*modes)/math.sqrt(len(base[y])) for y in train])
        rr=np.concatenate([(training_truth[y]-base[y]).ravel()/math.sqrt(len(base[y])) for y in train])
        coef,_,rank,sv=np.linalg.lstsq(xx,rr,rcond=None)
        if rank!=2*modes:raise ValueError("source nuisance rank")
        means.append(dict(role=label,coef=coef.tolist(),condition=float(sv[0]/sv[-1])))
        for y in years:forecasts[y].append(base[y]+design[y]@coef)
    def dx(y):
        start=date(y,1,1)
        return np.array([(basis(start+timedelta(days=i))-basis(start))[1:] for i in range(1,len(inputs[y][1])+1)])
    x=np.concatenate([dx(y)/math.sqrt(len(training_truth[y])) for y in train])
    rr=np.concatenate([(training_truth[y]-inputs[y][0])/math.sqrt(len(training_truth[y])) for y in train])
    coef,_,rank,sv=np.linalg.lstsq(x,rr,rcond=None)
    assert rank==3
    means.append(dict(role="trend_season_anchor",coef=coef.tolist(),condition=float(sv[0]/sv[-1])))
    for y in years:
        a=inputs[y][0]
        forecasts[y].extend([dx(y)@coef+a,np.broadcast_to(a,forecasts[y][0].shape).copy()])
    num=den=0.0
    for y in train:
        delta=forecasts[y][0]-forecasts[y][1];err=training_truth[y]-forecasts[y][1]
        num+=float(np.sum(delta*err)/len(delta))
        den+=float(np.sum(delta*delta)/len(delta))
    if den<=0:raise ValueError("indistinguishable candidates on source")
    gain=num/den
    for y in years:forecasts[y].append(forecasts[y][1]+gain*(forecasts[y][0]-forecasts[y][1]))
    means.append(dict(role="fitted_source_blend",gain=gain,source_difference_energy=den))
    return {y:np.stack(rows,axis=1) for y,rows in forecasts.items()},means
