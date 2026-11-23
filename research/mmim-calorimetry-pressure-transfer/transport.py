"""Calorimetry-driven temperature transport of measured solution pressures (SI internally)."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

import numpy as np
from scipy.optimize import least_squares

R=8.31446261815324
P0=101325.
TREF=298.15
TICKS=np.array([298.15,303.15,313.15,323.15])
MASS={'Water':.01801528,'Ethanol':.04606844,'Methanol':.03204186,'IL':.22218}
NUMBERS={'Water':(4,5,7,8),'Ethanol':(9,10,12,13),'Methanol':(14,15,17,18)}
XML='24eace5ef6275801aa4541e88054dacf029917037c96e0873938228018f12b25'
PURE='28494d1494a53f69dd026a9aa1cedc2c1ca91000c2ae9a2e1aaedafda020b6ac'
ARMS=('caloric_cp','caloric_no_cp','caloric_ideal_vapor','fixed_activity',
      'per_curve_activity_slope','per_curve_clausius','antoine_shared_shift',
      'caloric_residual_slope','nrtl_pressure','nrtl_pressure_heat')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def parse(xml):
    if sha(xml)!=XML:raise ValueError('source XML identity')
    doc=ET.parse(xml)
    for e in doc.iter():e.tag=e.tag.rsplit('}',1)[-1]
    return {int(e.findtext('nPureOrMixtureDataNumber')):e for e in doc.findall('PureOrMixtureData')}


def coord(elem):
    return {int(e.findtext('nVarNumber')):float(e.findtext('nVarValue')) for e in elem.findall('VariableValue')}


def value(elem):
    return float(elem.findtext('PropertyValue/nPropValue'))


def program_rows(record):
    groups={}
    for i,e in enumerate(record.findall('NumValues')):
        d=coord(e);groups.setdefault(d[1],[]).append((d[2],i,e))
    return {z:sorted(v,key=lambda q:q[0]) for z,v in groups.items()}


def rk(z,k):
    z=np.asarray(z)
    return np.stack([z*(1-z)*(2*z-1)**i for i in range(k+1)],axis=-1)


def partial_basis(z,k):
    rows=[]
    for i in range(k+1):
        t=2*z-1
        deriv=(1-2*z)*t**i + (2*i*z*(1-z)*t**(i-1) if i else 0)
        rows.append(z*(1-z)*t**i-z*deriv)
    return np.array(rows)


def fit_rk(z,y):
    z=np.asarray(z); y=np.asarray(y);indices=np.flatnonzero((z>0)&(z<1)); scores=[]
    for k in (0,1,2):
        loss=[]
        for i in indices:
            keep=np.arange(len(y))!=i
            b=np.linalg.lstsq(rk(z[keep],k),y[keep],rcond=1e-12)[0]
            loss.append(abs(float(rk(z[i],k)@b-y[i])))
        scores.append(np.mean(loss))
    k=int(np.argmin(scores))
    return np.linalg.lstsq(rk(z,k),y,rcond=1e-12)[0]


def prop_table(reference,solvent,T):
    values=[v for k,v in reference[solvent].items() if float(k)==float(T)]
    if len(values)!=1:raise ValueError(('nonunique or absent pure temperature',solvent,T))
    return values[0]


def thermal_inputs(source,reference,solvent):
    nh,nc,_,nv=NUMBERS[solvent]
    h=[(coord(e)[1],1000*value(e)) for e in source[nh].findall('NumValues')]
    h0=fit_rk(*zip(*h))
    cp_il={coord(e)[1]:value(e) for e in source[1].findall('NumValues')}
    cp=[]
    for T in TICKS:
        purecp=prop_table(reference,solvent,T)['cp_at_101325']
        data=[]
        for e in source[nc].findall('NumValues'):
            m=coord(e)
            if m[1]==T:
                z=m[2];data.append((z,value(e)-(1-z)*purecp-z*cp_il[T]))
        cp.append(fit_rk(*zip(*data)))
    # Measured molar volume at the highest available density temperature.
    # Hold its partial solvent excess volume fixed above/below that temperature.
    density=[]
    for e in source[nv].findall('NumValues'):
        m=coord(e)
        if m[1]==323.15:
            z=m[2];density.append((z,((1-z)*MASS[solvent]+z*MASS['IL'])/value(e)))
    v0=prop_table(reference,solvent,323.15)['v_liq_m3_mol']
    v1=next(v for z,v in density if z==1)
    ve=fit_rk([z for z,v in density],[v-(1-z)*v0-z*v1 for z,v in density])
    return h,h0,cp,ve


def part(z,b):
    return float(partial_basis(z,len(b)-1)@b)


def caloric(z,T,h0,cp,include_cp):
    # Integral -int Hbar(T)/(R*T^2)dT, using integration by parts:
    # H(T)/(RT)-H(T0)/(RT0) - int Cp(T)/(R*T)dT.
    init=part(z,h0)
    if not include_cp:return init*(1/T-1/TREF)/R
    values=[part(z,c) for c in cp]
    cuts=sorted({TREF,T,*[x for x in TICKS if TREF<x<T]})
    enthalpy=init; integral=0.
    for lo,hi in zip(cuts,cuts[1:]):
        a=float(np.interp(lo,TICKS,values));b=float(np.interp(hi,TICKS,values));s=(b-a)/(hi-lo)
        enthalpy+=(a+b)*(hi-lo)/2
        integral+=(a-s*lo)*math.log(hi/lo)+s*(hi-lo)
    return (enthalpy/T-init/TREF-integral)/R


def activity(P,T,z,ve,reference,solvent,nonideal=True):
    q=prop_table(reference,solvent,T)
    ps=q['pstar_pa'];res=math.log(P/ps)-math.log1p(-z)
    if not nonideal:return res
    u=P/(R*T);b=q['B_m3_mol'];c=q['C_m6_mol2']
    gas=b*u+.5*(c-b*b)*u*u
    vp=q['v_liq_m3_mol'];vs=vp+part(z,ve)
    return res+gas-math.log(q['phi_sat'])+(vp*(ps-P0)-vs*(P-P0))/(R*T)


def invert(target,T,z,ve,reference,solvent,nonideal=True):
    ps=prop_table(reference,solvent,T)['pstar_pa']
    lo,hi=math.log(ps*1e-7),math.log(1.5*ps)
    if nonideal:
        q=prop_table(reference,solvent,T)
        a=(q['C_m6_mol2']-q['B_m3_mol']**2)/(R*T)**2
        b=(q['B_m3_mol']-q['v_liq_m3_mol']-part(z,ve))/(R*T)
        points=[math.exp(lo),math.exp(hi)]
        if a>0 and points[0]<-b/(2*a)<points[1]:points.append(-b/(2*a))
        if min(1+b*p+a*p*p for p in points)<=0:raise ValueError('nonmonotone pressure inversion')
    def f(t):return activity(math.exp(t),T,z,ve,reference,solvent,nonideal)
    if not f(lo)<=target<=f(hi):raise ValueError(('pressure root outside fixed range',solvent,z,T,target))
    for _ in range(55):
        m=(lo+hi)/2
        if f(m)<target:lo=m
        else:hi=m
    return math.exp((lo+hi)/2)


def nrtl(z,beta,v,excess):
    a,b,c,d=v
    t21=a+b*1000*(beta-1/TREF);t12=c+d*1000*(beta-1/TREF)
    g21=np.exp(-.3*t21);g12=np.exp(-.3*t12);x=1-z
    d1=x+z*g21;d2=z+x*g12
    if excess:return x*z*(t21*g21/d1+t12*g12/d2)
    return z*z*(t21*(g21/d1)**2+t12*g12/d2**2)


def nrtl_fit(cal,h,heat):
    z,T,y=np.asarray(cal).T
    zh,hv=np.asarray(h).T
    def obj(v):
        r=nrtl(z,1/T,v,False)-y
        if heat:
            # Complex-step derivative of g^E/(RT) with respect to beta.
            predicted=R*nrtl(zh,1/TREF+1e-18j,v,True).imag/1e-18
            return np.r_[r,(predicted-hv)/10000]
        return r
    best=None
    for a,c in ((0,0),(-3,3),(3,-3),(-4,-1),(1,-4)):
        fit=least_squares(obj,[a,0,c,0],bounds=(-15,15),max_nfev=2500,
                          ftol=1e-11,xtol=1e-11,gtol=1e-11)
        if best is None or fit.cost<best.cost:best=fit
    return best.x,best.cost


def fitline(x,y,q):
    a=np.column_stack((np.ones(len(x)),x))
    b=np.linalg.lstsq(a,y,rcond=1e-12)[0]
    return float(b[0]+b[1]*q)


def forecast(source,refs):
    results={}; evidence={}
    for sol,(nh,nc,ns,nv) in NUMBERS.items():
        curves=program_rows(source[ns]);h,h0,cp,ve=thermal_inputs(source,refs,sol)
        cal=[];curves_known={}
        for z,entries in curves.items():
            # This is the only access to measured pressure in the forecast.
            # Held PropertyValue fields are not selected or converted.
            T=np.array([v[0] for v in entries[:4]])
            P=np.array([1000*value(v[2]) for v in entries[:4]])
            y=np.array([activity(p,t,z,ve,refs,sol) for t,p in zip(T,P)])
            curves_known[z]=(T,P,y)
            cal.extend(zip([z]*len(T),T,y))
        fits={arm:nrtl_fit(cal,h,arm=='nrtl_pressure_heat') for arm in ('nrtl_pressure','nrtl_pressure_heat')}
        shifts=(-125,-75,-25,0,40,80)
        cv=[]
        for shift in shifts:
            cv.append(sum((fitline(1000/(ts[:3]+shift),np.log(ps[:3]),1000/(ts[3]+shift))-math.log(ps[3]))**2
                          for ts,ps,ys in curves_known.values()))
        shift=shifts[int(np.argmin(cv))]
        evidence[sol]={'h0':h0.tolist(),'cp':[b.tolist() for b in cp],'ve':ve.tolist(),
            'antoine_shift':shift,'nrtl':{a:[v.tolist(),float(c)] for a,(v,c) in fits.items()}}
        for z,entries in curves.items():
            T,P,y=curves_known[z];beta=1000*(1/T-1/T.mean())
            phys=np.array([caloric(z,t,h0,cp,True) for t in T])
            simple=np.array([caloric(z,t,h0,cp,False) for t in T])
            ideal=np.array([activity(p,t,z,ve,refs,sol,False) for p,t in zip(P,T)])
            for t,i,_ in entries[4:]:
                corr=caloric(z,t,h0,cp,True);simple_t=caloric(z,t,h0,cp,False);x=1000*(1/t-1/T.mean())
                target={'caloric_cp':np.mean(y-phys)+corr,'caloric_no_cp':np.mean(y-simple)+simple_t,
                        'caloric_ideal_vapor':np.mean(ideal-phys)+corr,'fixed_activity':np.mean(y),
                        'per_curve_activity_slope':fitline(beta,y,x),
                        'caloric_residual_slope':corr+fitline(beta,y-phys,x),
                        **{a:float(nrtl(z,1/t,v,False)) for a,(v,c) in fits.items()}}
                pred={a:invert(v,t,z,ve,refs,sol,a!='caloric_ideal_vapor')/1000 for a,v in target.items()}
                pred['per_curve_clausius']=math.exp(fitline(beta,np.log(P),x))/1000
                pred['antoine_shared_shift']=math.exp(fitline(1000/(T+shift),np.log(P),1000/(t+shift)))/1000
                if set(pred)!=set(ARMS) or not all(math.isfinite(v) and v>0 for v in pred.values()):
                    raise ValueError('incomplete point bank')
                results[f'{sol}/{i}']={'solvent':sol,'dataset':ns,'row':i,'z':z,'T':t,'pred_kpa':pred}
    if len(results)!=83:raise ValueError(len(results))
    return {'rows':results,'fits':evidence}


def score(source,bank):
    truth={};errors={a:{} for a in ARMS}
    for key,v in bank['rows'].items():
        e=source[v['dataset']].findall('NumValues')[v['row']];d=coord(e)
        if (d[1],d[2])!=(v['z'],v['T']):raise ValueError('row identity')
        y=value(e);truth[key]=y
        for a,p in v['pred_kpa'].items():errors[a][key]=abs(math.log(p/y))
    metrics={}
    for a,data in errors.items():
        curves={}
        for key,err in data.items():
            v=bank['rows'][key];curves.setdefault((v['solvent'],v['z']),[]).append(err)
        metrics[a]={}
        for group in ('all',*NUMBERS):
            mean=[sum(vals)/len(vals) for (sol,z),vals in curves.items() if group=='all' or group==sol]
            metrics[a][group+'_mean']=sum(mean)/len(mean)
            metrics[a][group+'_worst']=max(mean)
    gates={k:all(v<metrics[a][k] for a in ARMS[1:]) for k,v in metrics[ARMS[0]].items()}
    worst=max(errors[ARMS[0]],key=errors[ARMS[0]].get)
    return {'truth_kpa':truth,'log_errors':errors,'metrics':metrics,'gates':gates,
            'worst':{'id':worst,'record':bank['rows'][worst],'observed_kpa':truth[worst]}}


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['forecast','score'])
    p.add_argument('xml',type=Path);p.add_argument('out',type=Path);p.add_argument('--bank',type=Path)
    p.add_argument('--bank-sha256');args=p.parse_args()
    pure=Path(__file__).with_name('pure.json')
    if sha(pure)!=PURE:raise ValueError('pure EOS source differs')
    source=parse(args.xml)
    if args.mode=='forecast':
        result=forecast(source,json.loads(pure.read_bytes())['pure'])
    else:
        if not args.bank or sha(args.bank)!=args.bank_sha256:raise ValueError('bank differs')
        result=score(source,json.loads(args.bank.read_bytes()))
    with args.out.open('x') as out:
        json.dump(result,out,separators=(',',':'),sort_keys=True,allow_nan=False);out.write('\n')
    print(args.mode,args.out,args.out.stat().st_size,sha(args.out),flush=True)
