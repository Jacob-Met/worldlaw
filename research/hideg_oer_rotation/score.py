"""Score only after byte-binding every frozen forecast."""
import hashlib,json,math
from acquisition import opened,rows,HELD

def mean(v): return math.fsum(v)/len(v)
def measure(raw,data,lock):
    if hashlib.sha256(raw).hexdigest()!=lock: raise ValueError("forecast hash")
    f=json.loads(raw);sweeps={};worst=None
    roles=['notebook_equations_full','notebook_equations_filtered','physics_without_solution_resistance','physics_fixed_speed','nearest_speed','current_linear_sqrt_rpm','current_linear_rpm','all_source_linear_sqrt_rpm','scaled_limiting_flux','corrected_physics']
    with opened(data) as z:
        if sorted(f['metals'])!=['Au','Ir','Pt']: raise ValueError("roster")
        # Verify the entire roster before selecting any measured target.
        for m,rec in f['metals'].items():
            if set(rec['predictions'])!=set(map(str,HELD)): raise ValueError("speeds")
            for r,arms in rec['predictions'].items():
                if set(arms)!=set(roles): raise ValueError("roles")
                n=rec['inputs'][r]['rows']
                if any(len(v)!=n or not all(math.isfinite(y) for y in v) for v in arms.values()): raise ValueError("shape")
        for m,rec in f['metals'].items():
            for r in HELD:
                e,y,info=rows(z,m,r,True);pred=rec['predictions'][str(r)]
                if info!=rec['inputs'][str(r)]: raise ValueError("input mismatch")
                err={k:[a-b for a,b in zip(v,y)] for k,v in pred.items()}
                rmse={k:math.sqrt(mean([x*x for x in v])) for k,v in err.items()}
                mae={k:mean([abs(x) for x in v]) for k,v in err.items()}
                i=max(range(len(y)),key=lambda i:abs(err['corrected_physics'][i]))
                cell=dict(metal=m,rpm=r,index=i,voltage=e[i],observed=y[i],pred={k:v[i] for k,v in pred.items()},absolute_error=abs(err['corrected_physics'][i]))
                if worst is None or cell['absolute_error']>worst['absolute_error']: worst=cell
                sweeps[m+str(r)]=dict(rpm=r,voltage=e,observed=y,rmse=rmse,mae=mae,worst=cell)
    means={k:mean([v['rmse'][k] for v in sweeps.values()]) for k in roles}
    candidate='corrected_physics';strong=min([k for k in roles if k!=candidate],key=means.get)
    wins=sum(v['rmse'][candidate]<v['rmse'][strong] for v in sweeps.values())
    by_speed={str(r):{k:mean([v['rmse'][k] for v in sweeps.values() if v['rpm']==r]) for k in roles} for r in HELD}
    passed=means[candidate]<means[strong] and wins>=4 and all(v[candidate]<v['notebook_equations_full'] for v in by_speed.values())
    return dict(mean_rmse=means,by_speed=by_speed,sweeps=sweeps,worst=worst,strongest_control=strong,wins=wins,passed=passed)
