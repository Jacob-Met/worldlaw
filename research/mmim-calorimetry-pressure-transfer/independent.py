"""Fresh scalar recovery of geometric-temperature pressure predictions and all scores."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

XML='24eace5ef6275801aa4541e88054dacf029917037c96e0873938228018f12b25'
PURE='28494d1494a53f69dd026a9aa1cedc2c1ca91000c2ae9a2e1aaedafda020b6ac'
DATA={'Water':7,'Ethanol':12,'Methanol':17}
ARMS=('caloric_cp','caloric_no_cp','caloric_ideal_vapor','fixed_activity','per_curve_activity_slope',
      'per_curve_clausius','antoine_shared_shift','caloric_residual_slope','nrtl_pressure','nrtl_pressure_heat')
R=8.31446261815324
KNOTS=(298.15,303.15,313.15,323.15)


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def partial(z,coeff):
    x=2*z-1
    return sum(b*z*z*((x**i)-(2*i*(1-z)*x**(i-1) if i else 0)) for i,b in enumerate(coeff))


def heat_model(z,T,fit):
    init=partial(z,fit['h0'])
    cp=[partial(z,k) for k in fit['cp']]
    def h(t):
        points=[v for v in KNOTS if v<t]+[t]
        total=init
        for a,b in zip(points,points[1:]):
            i=KNOTS.index(a);width=b-a
            slope=(cp[i+1]-cp[i])/(KNOTS[i+1]-a) if i+1<len(cp) else 0.
            total+=cp[i]*width+.5*slope*width**2
        return total
    cuts=[v for v in KNOTS if v<T]+[T]
    integral=0.
    for a,b in zip(cuts,cuts[1:]):
        # Direct numerical integration, independent of producer's integration by parts.
        n=128;dt=(b-a)/n
        integral+=dt/3*math.fsum((1 if j in (0,n) else (4 if j%2 else 2))*h(a+j*dt)/(a+j*dt)**2 for j in range(n+1))
    return -integral/R


def inferred_gamma(q,P,T,z,ve):
    volume=q['v_liq_m3_mol']
    vs=volume+partial(z,ve)
    b=q['B_m3_mol']; c=q['C_m6_mol2']; t=P/(R*T)
    return (math.log(P/(q['pstar_pa']*(1-z)))+b*t+(c-b*b)*t*t/2-math.log(q['phi_sat'])
            +(volume*(q['pstar_pa']-101325.)-vs*(P-101325.))/(R*T))


def verify(xml,pure,bank,score):
    x=ET.parse(xml)
    for e in x.iter():e.tag=e.tag.split('}')[-1]
    by_id={int(x.findtext('nPureOrMixtureDataNumber')):x for x in x.findall('PureOrMixtureData')}
    errors={a:{} for a in ARMS}; mismatch=0.; num=0; nprim=0; primary_rel=0.; groups={}
    def compare(a,b):
        nonlocal mismatch,num
        if not math.isclose(a,b,rel_tol=1e-9,abs_tol=2e-10):raise ValueError((a,b))
        mismatch=max(mismatch,abs(a-b));num+=1
    for sol,index in DATA.items():
        grouped={}
        for i,e in enumerate(by_id[index].findall('NumValues')):
            v={int(y.findtext('nVarNumber')):float(y.findtext('nVarValue')) for y in e.findall('VariableValue')}
            grouped.setdefault(v[1],[]).append((v[2],i,float(e.findtext('PropertyValue/nPropValue'))))
        for z,entries in grouped.items():
            seq=sorted(entries); fit=bank['fits'][sol]
            anchors=[]
            for t,i,y in seq[:4]:
                q,=[v for key,v in pure[sol].items() if float(key)==t]
                anchors.append(inferred_gamma(q,y*1000,t,z,fit['ve'])-heat_model(z,t,fit))
            for t,i,y in seq[4:]:
                key=f'{sol}/{i}';row=bank['rows'][key];groups[key]=(sol,z)
                if (row['T'],row['z'],row['dataset'],row['row'])!=(t,z,index,i):raise ValueError('row identity')
                if set(row['pred_kpa'])!=set(ARMS):raise ValueError('arm census')
                compare(y,score['truth_kpa'][key])
                q,=[v for key,v in pure[sol].items() if float(key)==t]
                target=math.fsum(anchors)/4+heat_model(z,t,fit)
                lo=q['pstar_pa']*1e-7;hi=1.5*q['pstar_pa']
                for _ in range(75):
                    mid=(hi+lo)*.5
                    if inferred_gamma(q,mid,t,z,fit['ve'])<target:lo=mid
                    else:hi=mid
                measured=row['pred_kpa']['caloric_cp']; calc=(lo+hi)*.0005
                relative=abs(calc/measured-1);primary_rel=max(primary_rel,relative);nprim+=1
                if relative>1e-8:raise ValueError(('primary transport',key,relative))
                for arm,forecast in row['pred_kpa'].items():
                    err=abs(math.log(forecast)-math.log(y));errors[arm][key]=err
                    compare(err,score['log_errors'][arm][key])
    if len(groups)!=83 or set(groups)!=set(bank['rows']):raise ValueError('held census')
    metrics={}
    for a,es in errors.items():
        by_curve={}
        for key,e in es.items():by_curve.setdefault(groups[key],[]).append(e)
        if len(by_curve)!=15:raise ValueError('curve census')
        metric={}
        for solvent in ('all',*DATA):
            relevant=[math.fsum(v)/len(v) for (g,z),v in by_curve.items() if solvent=='all' or g==solvent]
            for suffix,v in [('mean',math.fsum(relevant)/len(relevant)),('worst',max(relevant))]:
                metric[solvent+'_'+suffix]=v;compare(v,score['metrics'][a][solvent+'_'+suffix])
        metrics[a]=metric
    gate={name:all(v<metrics[a][name] for a in ARMS[1:]) for name,v in metrics[ARMS[0]].items()}
    if gate!=score['gates']:raise ValueError('gates')
    w=max(errors[ARMS[0]],key=errors[ARMS[0]].get)
    if w!=score['worst']['id']:raise ValueError('worst row')
    return {'rows':len(groups),'prediction_errors':sum(map(len,errors.values())),'primary_recomputed':nprim,
            'primary_max_relative_difference':primary_rel,'numeric_score_comparisons':num,
            'max_score_absolute_difference':mismatch,'gates':gate,'raw_worst':score['worst']}


if __name__=='__main__':
    p=argparse.ArgumentParser()
    for name in ('xml','pure','bank','score'):p.add_argument(name,type=Path)
    p.add_argument('bank_sha');p.add_argument('score_sha');a=p.parse_args()
    for path,digest in zip([a.xml,a.pure,a.bank,a.score],[XML,PURE,a.bank_sha,a.score_sha]):
        if sha(path)!=digest:raise ValueError('input digest')
    print(json.dumps(verify(a.xml,json.loads(a.pure.read_bytes())['pure'],json.loads(a.bank.read_bytes()),json.loads(a.score.read_bytes())),sort_keys=True))
