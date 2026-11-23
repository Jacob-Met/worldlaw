"""Independent scalar replay of all recorded target and forecast cells."""
import ast,base64,bisect,hashlib,io,json,math,struct,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent
def arr(raw):
    assert raw[:6]==b"\x93NUMPY" and raw[6:8]==b"\x01\x00"
    n=struct.unpack_from("<H",raw,8)[0];h=ast.literal_eval(raw[10:10+n].decode())
    assert h["descr"]=="<f8" and not h["fortran_order"]
    values=struct.unpack_from("<"+"d"*math.prod(h["shape"]),raw,10+n)
    assert 10+n+len(values)*8==len(raw)
    return values
def interp(x,y,z):
    if z<=x[0]:return y[0]
    if z>=x[-1]:return y[-1]
    i=bisect.bisect_right(x,z)-1
    return y[i]+(z-x[i])*(y[i+1]-y[i])/(x[i+1]-x[i])
def measure(t,v):
    d=[]
    for q in v:
        aq=abs(q)
        w=1 if aq<=5 else (.5+.5*math.cos(math.pi*(aq-5)/2.3) if aq<7.3 else 0.)
        if w:
            assert t["v"][0]<=q<=t["v"][-1]
            val=max(0,1-interp(t["v"],t["y"],q))*w
        else:val=0.
        d.append(val)
    full=math.fsum(d);area=full*.1;c=math.fsum(a*b for a,b in zip(v,d))/full
    return [interp(v,d,x+c)/area if v[0]<=x+c<=v[-1] else 0 for x in v],area,c
def main():
    data=base64.b64decode((root/"common_forecast_packet.txt").read_bytes(),validate=False)
    lock=json.loads((root/"common_forecast_lock.json").read_text())
    assert len(data)==lock["packet_bytes"] and hashlib.sha256(data).hexdigest()==lock["packet_sha256"]
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        v=arr(z.read("v.npy"));pred=arr(z.read("forecast.npy"));lines=arr(z.read("lines.npy"))
    scores=json.loads((root/"common_scores.json").read_text());truth=json.loads((root/"common_targets.json").read_text())
    assert len(truth)==len(scores["rows"])==24 and len(v)==441 and len(pred)==3*8*5*441
    errs=[];inputs=[];daily=[[[0.]*5 for _ in range(8)] for _ in range(3)];w=None;nr=0;im=0;foreign=False
    for n,(t,r) in enumerate(zip(truth,scores["rows"])):
        day,li=divmod(n,8);assert (t["d"],t["l"],r["date"],r["line"])==(day,li,day,lines[li])
        q,a,c=measure(t,v);inputs.extend(abs(x-y) for x,y in zip(q,t["target"]));inputs.extend((abs(a-r["a_c"][0]),abs(c-r["a_c"][1])))
        # Independently check the solar-rest coordinates via the recorded native Arg.
        fac=scores["sources"][day]["scale"]
        assert all(abs(299792.458*math.log(x*fac/lines[li])-h)<1e-9 for x,h in zip(t["x"],t["v"]))
        cts={k:t["mask"].count(k) for k in set(t["mask"])};assert cts==r["flags"];im+=len(cts)>1;foreign|=not set(cts)<={"46","54"}
        for k in range(5):
            b=pred[(n*5+k)*441:(n*5+k+1)*441]
            e=[y-x for x,y in zip(q,b)];nr+=len(e)
            for cut in [2,3,4,6]:
                p=[d for x,d in zip(v,e) if abs(x)<=cut]
                val=math.sqrt(math.fsum(d*d for d in p)/len(p));errs.append(abs(val-r["rmse"][str(cut)][k]))
                if cut==3:daily[day][li][k]=val
            if k==0:
                i=max((i for i,x in enumerate(v) if abs(x)<=3),key=lambda i:abs(e[i]))
                assert r["worst"]["v"]==v[i]
                if w is None or abs(e[i])>abs(w[3]):w=(day,li,v[i],e[i])
    means=[[math.fsum(row[k] for row in block)/8 for k in range(5)] for block in daily]
    errs.extend(abs(x-y) for row,stored in zip(means,scores["daily"]) for x,y in zip(row,stored))
    gate=not im and not foreign and all(row[0]<min(row[1:3]) for row in means);author=not im and not foreign and all(row[0]<row[4] for row in means)
    assert foreign==scores["nonstandard"] and bool(im)==scores["mixed"] and gate==scores["gate"] and author==scores["author_gate"]
    assert max(errs)<2e-12 and max(inputs)<2e-12
    peak=scores["worst"];assert (w[0],lines[w[1]],w[2])==(peak["date"],peak["line"],peak["v"]) and abs(w[3]-peak["residual"])<2e-12
    print(json.dumps(dict(checked_residuals=nr,checked_rmse=480,checked_daily=15,checked_observations=24*441,
       max_raw_delta=max(inputs),max_metric_delta=max(errs),mixed_rows=im,nonstandard=foreign,gate=gate,author_gate=author,worst=w,daily=means),sort_keys=True))
if __name__=="__main__":main()
