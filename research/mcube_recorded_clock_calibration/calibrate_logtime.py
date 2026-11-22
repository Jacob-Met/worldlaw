"""Offline metrology on the author's separate two-sensor move, never a push."""
from bisect import bisect_right
from decimal import Decimal
from hashlib import sha1, sha256
from math import isfinite, sqrt
from statistics import fmean, median
import json
from urllib.request import Request, urlopen

SOURCES = {
    "tip": ("Output_tip_tcpvicon.txt", "deb788a940999d5b87d710ef2cb754f99faabfb0", 125844),
    "marker": ("Output_vicon_tcpvicon.txt", "fdc715a7f4e8d48b74cf3de8d6eb88a58731e724", 149002),
}
BASE = "https://raw.githubusercontent.com/peterkty/pnpush/c8352f5fe9a4f03aa07bf3753e04ca7898df6e1f/catkin_ws/src/pnpush_planning/time_delay/"
LAGS_MS = tuple(range(-250, 251, 2))
NANO = 1000000000
MS = 1000000


def timespec(raw):
    value = Decimal(raw)
    if not value.is_finite():
        raise ValueError("nonfinite timestamp")
    ns = value if value >= Decimal(10)**16 else value*NANO
    if ns != ns.to_integral_value():
        raise ValueError("not representable in integer nanoseconds")
    return int(ns)


def read(label):
    name, oid, size = SOURCES[label]
    with urlopen(Request(BASE+name, headers={"User-Agent":"original-clock-metrology"}),timeout=45) as stream:
        data = stream.read()
    if len(data)!=size or sha1(b"blob "+str(size).encode()+b"\0"+data).hexdigest()!=oid:
        raise ValueError("calibration source changed")
    fields = data.decode("ascii").split()
    if len(fields)%2:
        raise ValueError("expected alternating original time and position")
    times, positions = [], []
    for i in range(0,len(fields),2):
        time, pos = timespec(fields[i]), float(fields[i+1])
        if not isfinite(pos) or (times and time<times[-1]):
            raise ValueError("nonfinite or reordered source")
        if times and time==times[-1]:
            if pos!=positions[-1]:
                raise ValueError("conflicting positions with identical timestamp")
            continue
        times.append(time); positions.append(pos)
    print(json.dumps({"source":label,"bytes":size,"git":oid,"sha256":sha256(data).hexdigest(),
                      "pairs":len(fields)//2,"distinct_times":len(times),"start_ns":times[0],"end_ns":times[-1],
                      "median_step_ms":median((b-a)/MS for a,b in zip(times,times[1:]))}),flush=True)
    return times, positions


def at(stream,t):
    ts,x=stream
    i=bisect_right(ts,t)-1
    if i<0 or t-ts[i]>40*MS:
        return None
    return x[i]


def block(start,end,tip,marker):
    # All lags and both streams share the same roster and the same half.
    # 40-ms hold margin prevents an eligible value from a previous half being read.
    first=start+290*MS
    grid=range(first,end-250*MS,4*MS)
    rows=[]
    for t in grid:
        marker_x=at(marker,t)
        if marker_x is None:
            continue
        tip_x=tuple(at(tip,t-lag*MS) for lag in LAGS_MS)
        if all(v is not None for v in tip_x):
            rows.append((t,marker_x,tip_x))
    if len(rows)<100:
        raise ValueError("fewer than 100 common grid points in a half")
    return rows,len(grid)


def affine(rows,j):
    y=[r[1] for r in rows];x=[r[2][j] for r in rows]
    xm,ym=fmean(x),fmean(y)
    variance=sum((v-xm)**2 for v in x)
    if variance==0:
        raise ValueError("constant tip channel")
    b=sum((v-xm)*(w-ym) for v,w in zip(x,y))/variance
    return ym-b*xm,b


def residuals(rows,j,co):
    a,b=co
    return [r[1]-(a+b*r[2][j]) for r in rows]


def rms(res):
    return sqrt(fmean(r*r for r in res))


def main():
    tip, marker=read("tip"), read("marker")
    start=max(tip[0][0],marker[0][0]);end=min(tip[0][-1],marker[0][-1]);mid=(start+end)//2
    train,tr_total=block(start,mid,tip,marker);held,te_total=block(mid,end,tip,marker)
    fits=[]
    for j,lag in enumerate(LAGS_MS):
        co=affine(train,j)
        fits.append((rms(residuals(train,j,co)),abs(lag),lag,j,co))
    fits.sort()
    best=fits[0];base=next(x for x in fits if x[2]==0)
    output={"calibration_only":True,"time_ns":[start,mid,end],"grid_ms":4,"max_age_ms":40,
            "rows_train":[len(train),tr_total],"rows_test":[len(held),te_total],
            "top_training_offsets_ms":[[x[2],x[0]] for x in fits[:5]],"test":{}}
    res={}
    for role,row in [("fixed_zero",base),("trained_offset",best)]:
        loss,_,lag,j,co=row
        res[role]=residuals(held,j,co)
        output["test"][role]={"lag_ms":lag, "affine_intercept_slope":co,
                               "train_RMSE":loss,"test_RMSE":rms(res[role]),
                               "max_abs":max(map(abs,res[role]))}
    w=max(range(len(held)),key=lambda i:abs(res["trained_offset"][i]));t,y,x=held[w]
    output["worst_trained_row"]={"timestamp_ns":t,"marker_native":y,
        "tip_at_trained_offset":x[best[3]],"tip_at_zero":x[base[3]],
        "predicted_trained":y-res["trained_offset"][w],"predicted_zero":y-res["fixed_zero"][w]}
    print(json.dumps(output,sort_keys=True,allow_nan=False),flush=True)


if __name__=="__main__":
    main()
