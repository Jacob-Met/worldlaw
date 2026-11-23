"""Conditional transfer of whole-cell apparent resistance using local phase fractions."""
from bisect import bisect_right
import math

MU_O = 0.838
MU_W = 0.822
MU_REF = (MU_O + MU_W) / 2
ROLES = ("occupancy-midpoint", "same-flow-fraction", "mean-saturation",
         "endpoint-switch", "connected-stable", "connected-permissive",
         "cyclic-support", "full-support-midpoint")

def resistance(k_oil, k_water):
    mobility = MU_REF * (k_oil / MU_O + k_water / MU_W)
    if mobility <= 0:
        raise ValueError("nonpositive apparent total mobility")
    return 1 / mobility

def rounding_half(token):
    s = str(token).strip()
    return 0.5 * 10 ** -len(s.split(".")[1]) if "." in s else 0.5

def interpolator(knots):
    xs = sorted(knots)
    if len(xs) != len(set(xs)):
        raise ValueError("duplicate source saturation")
    def evaluate(s):
        if s <= xs[0]:
            return knots[xs[0]]
        if s >= xs[-1]:
            return knots[xs[-1]]
        j = bisect_right(xs,s)
        a,b = xs[j-1:j+1]
        return knots[a] + (knots[b]-knots[a])*(s-a)/(b-a)
    return evaluate

def attainable(knots, mean, lo, hi):
    if not 0 <= lo <= mean <= hi <= 1:
        raise ValueError("mean outside occupancy support")
    fun = interpolator(knots)
    vertices = sorted({lo,hi,*(x for x in knots if lo < x < hi)})
    candidates = [(fun(mean),mean,mean)]
    for left in vertices:
        for right in vertices:
            if left <= mean <= right and left < right:
                w = (right-mean)/(right-left)
                candidates.append((w*fun(left)+(1-w)*fun(right),left,right))
    return min(candidates),max(candidates)

def phase_support(row):
    # W and O are percentages of total pore space, not of bulk rock.
    water,oil,intermittent = (float(row[k]) for k in ("water","oil","intermittent"))
    if abs(water+oil+intermittent-100) > sum(rounding_half(row[k]) for k in ("water","oil","intermittent"))+1e-9:
        raise ValueError("phase percentages do not close within printed precision")
    low = max(0,(water-rounding_half(row["water"]))/100)
    high = min(1,1-(oil-rounding_half(row["oil"]))/100)
    s = float(row["Sw"])
    if s < low or s > high:
        raise ValueError("reported mean incompatible with printed stable phase bounds")
    return low, high

def connection_forecast(f,r_low,s_low,c_low,high,permissive):
    s=float(high["Sw"])
    gain=f*s/s_low if f else 0.
    if f < 1:
        active_low=(1-s_low)*c_low/100
        if active_low<=0:
            raise ValueError("no low-rate connected oil capacity")
        eligible=float(high["oil"])+(float(high["intermittent"]) if permissive else 0.)
        percent=float(high["conn_union"] if permissive else high["conn_stable"])
        gain+=(1-f)*eligible*percent/10000/active_low
    if gain<=0:
        raise ValueError("zero parallel capacity")
    return r_low/gain

def build(low,high):
    fs=[float(x[0]) for x in low["Table 2"]]
    if fs!=[0,.15,.3,.5,.7,.85,1] or [float(r["fw"]) for r in high]!=fs:
        raise ValueError("unexpected physical stages")
    low1={float(r[0]):r for r in low["Table 1"]}
    source={}
    knots={}
    for f,sw,oil,water in low["Table 2"]:
        f,s=float(f),float(sw)
        if float(low1[f][1])!=s or s in knots: raise ValueError("inconsistent low-rate calibration")
        value=resistance(float(oil),float(water))
        knots[s]=value
        source[f]=(s,value,float(low1[f][2]))
    evaluate=interpolator(knots)
    supports=[phase_support(r) for r in high]
    results=[]
    for i,(f,row) in enumerate(zip(fs,high)):
        s, (lo,hi)=float(row["Sw"]),supports[i]
        first,last=attainable(knots,s,lo,hi)
        vals={"occupancy-midpoint":(first[0]+last[0])/2,
              "same-flow-fraction":source[f][1],"mean-saturation":evaluate(s)}
        vals["endpoint-switch"] = evaluate(lo) if hi==lo else ((hi-s)*evaluate(lo)+(s-lo)*evaluate(hi))/(hi-lo)
        donor=1+(i%5) if 1<=i<=5 else i
        d_lo,d_hi=supports[donor]; ds=float(high[donor]["Sw"])
        sham_lo=max(0,s-(ds-d_lo));sham_hi=min(1,s+d_hi-ds)
        sham=attainable(knots,s,sham_lo,sham_hi)
        vals["cyclic-support"]=(sham[0][0]+sham[1][0])/2
        full=attainable(knots,s,0,1)
        vals["full-support-midpoint"]=(full[0][0]+full[1][0])/2
        for key,permissive in (("connected-stable",False),("connected-permissive",True)):
            try:
                vals[key]=connection_forecast(f,source[f][1],source[f][0],source[f][2],row,permissive)
            except (ValueError, ZeroDivisionError) as e:
                vals[key]={"refusal":str(e)}
        if set(vals)!=set(ROLES) or any(not math.isfinite(v) for v in vals.values() if isinstance(v,float)):
            raise ValueError("incomplete role predictions")
        results.append({"fw":f,"low_Sw":source[f][0],"high_Sw":s,"support":[lo,hi],
                        "R_interval":[first[0],last[0]],"extreme_Sw_states":[first[1:],last[1:]],
                        "full_support_interval":[full[0][0],full[1][0]],"sham_support":[sham_lo,sham_hi],
                        "out_of_calibration_support":lo<min(knots) or hi>max(knots),"values":vals})
    return results
