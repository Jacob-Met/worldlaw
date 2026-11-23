"""Independent standard-library raw-archive check of the necessary full-path condition."""
import bisect,csv,hashlib,io,json,math,pathlib,sys,zipfile
N=32768
G=[i/N for i in range(N)]
C=[math.cos(2*math.pi*x) for x in G]
S=[math.sin(2*math.pi*x) for x in G]
def wave(root,ring,run):
    with zipfile.ZipFile(pathlib.Path(root)/("Ring%d_Dataset_Txt.zip"%ring)) as z:
        with z.open(run["path"]) as raw:
            f=csv.DictReader(io.TextIOWrapper(raw,encoding="utf-8-sig"))
            assert f.fieldnames==["t_s","B_T","H_Aperm","dBdt_Tpers"]
            pairs=[(float(row["t_s"]),float(row["B_T"])) for row in f]
    t0=pairs[0][0]
    points=[((t-t0)*run["f"],b) for t,b in pairs]
    ds=sorted(points[i][0]-points[i-1][0] for i in range(1,len(points)))
    mid=(ds[(len(ds)-1)//2]+ds[len(ds)//2])/2
    if abs(points[-1][0]-1)<mid/2:points.pop()
    assert all(0<=x<1 for x,_ in points)
    times=[points[-1][0]-1]+[v[0] for v in points]+[points[0][0]+1]
    values=[points[-1][1]]+[v[1] for v in points]+[points[0][1]]
    def get(x):
        i=bisect.bisect_right(times,x)-1
        return values[i]+(x-times[i])*(values[i+1]-values[i])/(times[i+1]-times[i])
    y=[get(t) for t in G]
    a=math.fsum(b*c for b,c in zip(y,C)); b=math.fsum(yj*sj for yj,sj in zip(y,S))
    offset=math.atan2(b,a)/(2*math.pi)
    return [get((x+offset)%1) for x in G]
root=sys.argv[1]
reg=json.load(open("pwm_registration.json"));score=json.load(open("pwm-results.json"))
errors=[];out=[]
for g,s in zip(reg["groups"],score["groups"]):
    assert g["key"]==s["group"]
    target=wave(root,g["ring"],g["runs"][-1])
    for r,p in zip(g["runs"][:-1],s["pairs"]):
        assert r["f"]==p["source_frequency"]
        source=wave(root,g["ring"],r)
        d=[abs(x-y) for x,y in zip(source,target)]
        i=max(range(N),key=d.__getitem__)
        errors.extend([abs(d[i]-p["max_abs_B_diff_T"]),abs(source[i]-p["worst_source_B_T"]),abs(target[i]-p["worst_target_B_T"])])
        assert i==p["worst_grid_index"] and d[i]>.005*g["amplitude"] and not p["pass_pair"]
        out.append([g["key"],r["f"],i,d[i]])
assert len(out)==24 and max(errors)<1e-11
print(json.dumps(dict(pairs=len(out),aligned_values=2*N*len(out),all_rejected_by_full_path_alone=True,max_abs_disagreement_T=max(errors),max_pair=max(out,key=lambda row:row[-1]),min_pair=min(out,key=lambda row:row[-1]),H_decoded=False),sort_keys=True))
