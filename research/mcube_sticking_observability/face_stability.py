"""Conservative pre-target sensitivity gate for the normalized one-face law.

Source secants and all angular rates are already in the declared initial
body frame. All three components of z have units m/s, including ell*omega.
"""
from math import cos, hypot, radians, sin, sqrt
import json
import numpy as np

ELL = 0.045
PROBE_RADIUS = 0.00475
DT = 0.100
OBJECT = 0.0005
TIP = 0.0001
ANGLE = radians(0.5)
TURN = 2*sin(ANGLE/2)
SPEED = 0.020
ET = (OBJECT + TIP + TURN*(sqrt(2)*ELL + PROBE_RADIUS + OBJECT + TIP))/ELL


def add(a,b):
    return a[0]+b[0],a[1]+b[1]


def multiply(a,b):
    vals=[x*y for x in a for y in b]
    return min(vals),max(vals)


def around(x,e):
    return x-e,x+e


def design(t,z):
    x,y,w=z
    return [t*y+x,t*w+x,y,w],-t*x


def bounded_fit(observations):
    rows,targets,errors,response_errors=[],[],[],[]
    for t,z in observations:
        x,y,w=z
        ez=2*OBJECT/DT + TURN*(hypot(x,y)+2*OBJECT/DT)
        ew=2*ELL*ANGLE/DT
        def product_error(v,e):
            return abs(t)*e+abs(v)*ET+ET*e
        design_row,target=design(t,z)
        rows.append(design_row); targets.append(target)
        errors.append([product_error(y,ez)+ez,product_error(w,ew)+ez,ez,ew])
        response_errors.append(product_error(x,ez))
    a=np.asarray(rows); b=np.asarray(targets)
    co,_,rank,singular=np.linalg.lstsq(a,b,rcond=None)
    perturb=np.linalg.norm(errors)
    sigma=singular[-1] if len(singular)==4 else 0.0
    result={"source_rows":len(rows),"nominal_rank":int(rank),"sigma_min":float(sigma),
            "entrywise_perturbation_frobenius":float(perturb),"time_window_s":DT,
            "normalized_contact_position_radius":ET,"assumptions":"nominal reported sensitivity, secant law, negligible spin/compliance and aligned log clocks"}
    if rank!=4 or sigma<=perturb:
        return {**result,"resolved":False,"reason":"The registered singular-value lower bound does not certify rank four"}
    radius=(np.linalg.norm(b-a@co) + np.linalg.norm(response_errors)+perturb*np.linalg.norm(co))/(sigma-perturb)
    return {**result,"resolved":True,"co":list(map(float,co)),"radius":float(radius)}


def twist_bounds(co,radius,t,ux,uy,eu):
    """Enclose all theta within the fitted Euclidean radius and all input intervals."""
    ay,az,by,bz=co
    lo,hi=around(t,ET)
    p=ay+az
    denom=lambda s:s*s+2*p*s+by+bz
    point=min(hi,max(lo,-p))
    perturb=radius*sqrt(8*max(abs(hi),abs(lo))**2+2)
    dlow=denom(point)-perturb
    dhigh=max(denom(lo),denom(hi))+perturb
    if dlow<=0:
        raise ValueError("Denominator can reach zero")
    x,y=around(ux,eu),around(uy,eu)
    nx=add((lo,hi),around(p,sqrt(2)*radius))
    ny=add(multiply((lo,hi),around(ay,radius)),around(by,radius))
    num=add(multiply(nx,x),multiply(ny,y))
    spin=multiply((-num[1],-num[0]),(1/dhigh,1/dlow))
    return [add(x,multiply((lo,hi),spin)),add(y,spin),spin]


def stress(observations):
    result=bounded_fit(observations)
    if not result["resolved"]:
        return result
    ay,az,by,bz=result['co']
    r=result['radius']
    gram_lower=by+bz-sqrt(2)*r-(abs(ay+az)+sqrt(2)*r)**2
    if gram_lower<=0:
        return {**result,'resolved':False,'gram_determinant_lower':gram_lower,'reason':'Positive-definite completion not certified'}
    # All released design angles at both reserved sites, a source-only grid.
    eu=2*TIP/DT+TURN*(SPEED+2*TIP/DT)
    worst=(-1,None)
    for t in (-0.6,0.6):
        for j in range(-15,16):
            beta=j/10
            try:
                bounds=twist_bounds(result['co'],result['radius'],t,SPEED*cos(beta),SPEED*sin(beta),eu)
            except ValueError as exc:
                return {**result,"resolved":False,"reason":str(exc),"t":t,"angle":beta}
            for channel,(low,high) in enumerate(bounds):
                if high-low>worst[0]:
                    worst=(high-low,(t,beta,channel,low,high))
    return {**result,"resolved":worst[0]<SPEED,"max_width_m_per_s":worst[0],"worst":worst[1],
            "reason":"Width threshold is the full commanded speed"}


def qualify():
    from fractions import Fraction as Q
    from sticking_operator import contact_basis,matvec
    ell=Q(45,1000)
    h=((Q(2),Q(1,3),Q(-1,4)),(Q(1,3),Q(4,3),Q(2,7)),(Q(-1,4),Q(2,7),Q(3,2)))
    obs=[]
    for site in (0,1,3,4,5,6,7,9,10):
        t=Q(site-5,5)
        b=contact_basis((-ell,ell*t),ell)
        for tangent in (Q(-1,4),Q(0),Q(1,4)):
            wrench=(Q(1),tangent,b[0][2]+tangent*b[1][2])
            z=tuple(float(x/50) for x in matvec(h,wrench))
            obs.append((float(t),z))
    result=stress(obs)
    assert result['nominal_rank']==4 and not result['resolved']
    print(json.dumps(result,sort_keys=True))
    # Confirm the enclosed nominal point is a member for the strict second gate.
    co=(-0.2,0.1,0.3,1.0)
    b=twist_bounds(co,0.0,0.6,0.02,0.0,0.0)
    spin=-0.5*0.02/(0.36-0.12+1.3)
    assert all(lo<=a<=hi for (lo,hi),a in zip(b,(0.02+0.6*spin,spin,spin)))


if __name__=="__main__":
    qualify()
