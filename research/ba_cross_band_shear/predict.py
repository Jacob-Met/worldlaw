"""Predict the reserved seven shear speeds from the projected source table."""
import json,math,statistics
from inputs import projected,PRESSURES
mean=statistics.fmean
UNCONSTRAINED={"calibrated_unbounded","direct_unbounded"}
def fit(xs,ys,z,clip=False):
    avg=mean(xs);avgy=mean(ys);ss=sum((x-avg)**2 for x in xs)
    raw=sum((x-avg)*(y-avgy) for x,y in zip(xs,ys))/ss if ss else 0.
    b=max(0.,min(.75,raw)) if clip else raw
    weights=[1/len(xs)+(z-avg)*(x-avg)/ss if ss else 1/len(xs) for x in xs]
    return {"raw_slope":raw,"slope":b,"value":avgy+b*(z-avg),"weight_l1":sum(map(abs,weights)),"x_min":min(xs),"x_max":max(xs),"x_star":z,"sxx":ss}
def prepare(inp,pressures,fmax):
    allp={}
    for p in pressures:
        fluids={}
        for fluid in ("Gas","Brine"):
            low=[r for r in inp["Seismic_"+fluid][p] if r[0]<=fmax]
            x=[v[1]**2 for v in low];y=[v[2]**2 for v in low];u=inp["Ultrasonic_"+fluid][p]
            fluids[fluid]={"x":x,"y":y,"up":u[0]**2,"us":u[1]**2 if fluid=="Gas" else None,"fit":fit(x,y,u[0]**2,True),"free":fit(x,y,u[0]**2)}
        allp[p]=fluids
    return allp
def forecasts(inp,pressures,fmax):
    q=prepare(inp,pressures,fmax);rows=[];fits={}
    gx=[q[p]["Gas"]["up"]-q[p]["Gas"]["x"][-1] for p in pressures]
    gy=[q[p]["Gas"]["us"]-q[p]["Gas"]["y"][-1] for p in pressures]
    for i,p in enumerate(pressures):
        g=q[p]["Gas"];b=q[p]["Brine"];nextg=q[pressures[(i+1)%len(pressures)]]["Gas"]
        x,y=b["x"],b["y"];ub=b["up"];delta=ub-x[-1]
        residual=g["us"]-g["fit"]["value"]
        v={"calibrated_constrained":b["fit"]["value"]+residual,"direct_constrained":b["fit"]["value"],
           "calibrated_unbounded":b["free"]["value"]+(g["us"]-g["free"]["value"]),"direct_unbounded":b["free"]["value"],
           "cyclic_residual":b["fit"]["value"]+(nextg["us"]-nextg["fit"]["value"]),"brine_last_shear":y[-1],
           "brine_mean_shear":mean([math.sqrt(v) for v in y])**2,"brine_last_poisson":y[-1]/x[-1]*ub,
           "gas_ultrasonic_shear":g["us"],"gas_ultrasonic_poisson":ub*g["us"]/g["up"],
           "gas_shear_ratio":y[-1]*g["us"]/g["y"][-1],"gas_shear_increment":y[-1]+g["us"]-g["y"][-1],
           "brine_origin_regression":ub*sum(a*c for a,c in zip(x,y))/sum(a*a for a in x),
           "gas_global_increment":y[-1]+fit(gx,gy,delta)["value"],"all_shear_change":y[-1]+.75*delta}
        out={k:math.sqrt(z) if z>0 and math.isfinite(z) else None for k,z in v.items()}
        rows.append({"pressure":p,"forecast":out,"squared":v})
        fits[p]={"gas":g["fit"],"brine":b["fit"],"gas_calibration_residual_squared":residual,"upper_bound_fixed_x":1+max(1.,b["fit"]["weight_l1"])+max(1.,g["fit"]["weight_l1"])}
    strict=sorted(set(rows[0]["forecast"])-UNCONSTRAINED-{"calibrated_constrained"})
    refusals=[]
    for r in rows:
        for k,v in r["forecast"].items():
            if v is None:refusals.append(["nonpositive_or_nonfinite",r["pressure"],k,r["squared"][k]])
    for k in strict:
        n=sum(r["forecast"][k]!=r["forecast"]["calibrated_constrained"] for r in rows)
        if n<len(rows)//2+1:refusals.append(["insufficient_distinct_rows",k,n])
    return {"rows":rows,"fits":fits,"strict_controls":strict,"refusals":refusals,"max_frequency_hz":fmax}
def main():
    inp=projected()
    out={"projected_inputs":inp,"primary":forecasts(inp,PRESSURES,128),"paper_range":forecasts(inp,(5,8,10,15,20),100)}
    print(json.dumps(out,sort_keys=True,separators=(",",":"),allow_nan=False))
if __name__=="__main__":main()
