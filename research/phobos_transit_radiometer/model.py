"""Source-calibrated thermal responses to the measured solar-array current deficit."""
from bisect import bisect_left
import math
from statistics import fmean


def line(pairs):
    avg_t, avg_y = (fmean(col) for col in zip(*pairs))
    slope = sum((t-avg_t)*(y-avg_y) for t,y in pairs)/sum((t-avg_t)**2 for t,y in pairs)
    return avg_y - slope*avg_t, slope


def prepare(event):
    c0, c1 = line([(t,v) for t,v in event["current"] if -90 <= t <= -25])
    t0, t1 = line(event["early"])
    width = event["spec"]["width"]
    interior = [(t, max(0., c0+c1*t-i)) for t,i in event["current"] if abs(t) <= width/2]
    ends = [t for t,q in interior[1:]] + [width/2]
    assert c0 > 0 and max(q for _,q in interior) > 0
    return dict(times=event["times"], width=width, base=[t0+t1*t for t in event["times"]],
                observed=[t0+t1*t-y for t,y in event["targets"]], current0=c0,
                elevation=event["spec"]["elevation_deg"], intervals=[(t,e,q) for (t,q),e in zip(interior,ends)])


def response(event, family, shape):
    features=[]
    for t in event["times"]:
        v=0.
        for a,b,q in event["intervals"]:
            if t < a:
                continue
            end = min(t,b)
            if family == "instantaneous":
                weight = float(a <= t < b)
            elif family == "exp":
                weight = math.exp(-(t-end)/shape)-math.exp(-(t-a)/shape)
            else:
                weight = (t-a)**shape-(t-end)**shape
            v += q*weight
        if family == "normalized":
            v /= event["current0"]
        if family == "elevation":
            v *= math.sin(math.radians(event["elevation"]))/event["current0"]
        features.append(v)
    return features


def weighted_fit(xs,ys):
    den = sum(x*x for x in xs)
    if den <= 0:
        raise ValueError("zero training excitation")
    gain = max(0.,sum(x*y for x,y in zip(xs,ys))/den)
    return sum((gain*x-y)**2 for x,y in zip(xs,ys)),gain


def interpolated(t,xs,ys):
    i=bisect_left(xs,t)
    if i<len(xs) and t==xs[i]:
        return ys[i]
    if i==0 or i==len(xs):
        return 0.
    frac=(t-xs[i-1])/(xs[i]-xs[i-1])
    return ys[i-1]*(1-frac)+ys[i]*frac


def forecast(events, protocol):
    ev={s:prepare(e) for s,e in events.items()}
    train=ev[protocol["calibration_sol"]]
    opts={"instantaneous":("instantaneous",[1]),"integral":("power",[1]),
          "halfspace":("power",[.5]),"fractional_selected":("power",[.25,.5,.75,1.]),
          "exponential_selected":("exp",[2,4,8,16,32,64]),
          "normalized_halfspace":("normalized",[.5]),"solar_elevation_halfspace":("elevation",[.5])}
    selected={}
    for role,(family,shapes) in opts.items():
        possible=[]
        for shape in shapes:
            err,gain=weighted_fit(response(train,family,shape),train["observed"])
            possible.append((err,shape,gain))
        err,shape,gain=min(possible,key=lambda v:v[0])
        selected[role]=dict(family=family,shape=shape,gain=gain,source_sse=err)
    out={}
    for sol,case in ev.items():
        pred={"zero":case["base"]}
        for role,param in selected.items():
            xs=response(case,param["family"],param["shape"])
            pred[role]=[b-param["gain"]*x for b,x in zip(case["base"],xs)]
        amp=max(x[2] for x in case["intervals"])/max(x[2] for x in train["intervals"])
        pred["phase_template"]=[b-amp*interpolated(t*train["width"]/case["width"],train["times"],train["observed"]) for b,t in zip(case["base"],case["times"])]
        assert set(pred)==set(protocol["roles"])
        out[sol]=dict(times=case["times"],predictions=pred,current_intervals_A=case["intervals"],current_baseline_A=case["current0"])
    return dict(source=protocol["calibration_sol"],models=selected,events=out)
