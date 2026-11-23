"""Stage donor calibration, prefix-only forecasts and held response receiving separately."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from extract import harvest
from models import ARMS,forecast

def write_json(path,value):
    path.write_text(json.dumps(value,sort_keys=True,separators=(",",":"),allow_nan=False)+"\n")

def filehash(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        while data:=f.read(1048576):h.update(data)
    return h.hexdigest()

def idhash(ids):
    return hashlib.sha256(("\n".join(ids)+"\n").encode()).hexdigest()

def pack(path,records,fields):
    keys=sorted(records)
    arrays={"keys":np.asarray([json.dumps(k,separators=(",",":")) for k in keys])}
    for i,k in enumerate(keys):
        for field in fields:
            arrays[f"{i}_{field}"]=records[k][field]
    np.savez_compressed(path,**arrays)

def donor(path,dest):
    data,ledger=harvest(path,"donor");refs={}
    for key,group in data.items():
        x=np.asarray(group["x"],dtype=float);y=np.asarray(group["y"],dtype=np.uint8)
        ok=np.all(np.isfinite(x),axis=1)&np.all(y!=255,axis=1)
        if not np.any(ok):raise ValueError(("Empty donor support",key))
        refs[key]={"x":x[ok],"y":y[ok],"ids_hash":idhash(group["ids"]),"counts":np.asarray([len(ok),ok.sum()])}
    pack(dest/"donors.npz",refs,("x","y","ids_hash","counts"))
    write_json(dest/"donor-ledger.json",ledger)
    print("DONORS",len(refs),sum(int(x["counts"][0]) for x in refs.values()),sum(int(x["counts"][1]) for x in refs.values()))

def predict(path,bank,dest):
    data,ledger=harvest(path,"prefix");predictions={}
    with np.load(bank,allow_pickle=False) as b:
        lookup={tuple(json.loads(k)):i for i,k in enumerate(b["keys"])}
        for key,g in data.items():
            i=lookup[key]
            z=np.asarray(g["x"],dtype=float).reshape(-1,7)
            ok=np.all(np.isfinite(z),axis=1)
            p=np.full((len(z),len(ARMS),7),np.nan)
            if np.any(ok):p[ok]=forecast(b[f"{i}_x"],b[f"{i}_y"],z[ok])
            predictions[key]={"p":p,"ids_hash":idhash(g["ids"]),"x":z}
    pack(dest/"predictions.npz",predictions,("p","ids_hash","x"))
    write_json(dest/"prefix-ledger.json",ledger)
    print("PREFIX_STRATA",len(predictions),"PATHS",sum(len(g["p"]) for g in predictions.values()))

def summarize(rows):
    out={}
    for cohort in sorted(set(g["key"][0] for g in rows)):
        used=[g for g in rows if g["key"][0]==cohort]
        seen=[g for g in used if g["observed"]]
        point=np.asarray([g["arm_sum"] for g in seen])/np.asarray([[g["observed"]] for g in seen])
        lo=[];hi=[]
        for g in used:
            total=g["observed"]+g["unknown"]
            if not total:raise ValueError(("Uncounted source stratum",g["key"]))
            lo.append(np.asarray(g["arm_sum"])/total)
            hi.append((np.asarray(g["arm_sum"])+g["unknown"])/total)
        out[cohort]={"observed":sum(g["observed"] for g in used),"unknown":sum(g["unknown"] for g in used),
          "seen_strata":len(seen),"declared_strata":len(used),"point":point.mean(axis=0).tolist(),
          "declared_lower":np.mean(lo,axis=0).tolist(),"declared_upper":np.mean(hi,axis=0).tolist(),
          "worst_stratum":point.max(axis=0).tolist()}
    physical=[g for name,g in out.items() if name.startswith("Hairpin ")]
    if len(physical)!=3:raise ValueError("Hairpin roster")
    point=np.asarray([g["point"] for g in physical])
    mean=point.mean(axis=0);worst=point.max(axis=0)
    j=ARMS.index("history64");ks=[ARMS.index(mode+str(k)) for mode in ("state","recent") for k in (16,64,256)]
    s=ARMS.index("shuffled64")
    gates={"mean_beats_all_six":bool(mean[j]<min(mean[ks])),"worst_beats_all_six":bool(worst[j]<min(worst[ks])),
           "mean_beats_shuffled":bool(mean[j]<mean[s]),"worst_beats_shuffled":bool(worst[j]<worst[s])}
    return {"cohorts":out,"mean":mean.tolist(),"worst":worst.tolist(),"gates":gates,"joint":all(gates.values())}

def score(path,lock,dest):
    data,ledger=harvest(path,"score")
    rows=[];worst=None
    with np.load(lock,allow_pickle=False) as b:
        lookup={tuple(json.loads(k)):i for i,k in enumerate(b["keys"])}
        for key,g in data.items():
            i=lookup[key]
            p=b[f"{i}_p"];x=b[f"{i}_x"]
            if str(b[f"{i}_ids_hash"])!=idhash(g["ids"]):raise ValueError("Forecast identity")
            actual=np.asarray(g["x"],dtype=float).reshape(-1,7)
            if not np.array_equal(x,actual,equal_nan=True):raise ValueError("Changed issued prefix")
            y=np.asarray(g["y"],dtype=np.uint8).reshape(-1,7)
            ok=np.all(y!=255,axis=1)&np.isfinite(p[:,0,0])
            e=np.mean((p[ok]-y[ok,None,:])**2,axis=2)
            scope=[r for r in ledger if tuple(r["key"])==key]
            missing=sum(r["declared"] for r in scope if not r["present"] or r.get("unbound_header"))
            r={"key":key,"registered_files":len(scope),"present_files":sum(r["present"] for r in scope),
               "physical_columns":len(ok),"issued":int(np.isfinite(x[:,0]).sum()),"observed":int(ok.sum()),
               "observed_timeout":int(np.sum(x[ok,2]==0)),"unknown":int((~ok).sum())+missing,
               "declared_missing_or_unbound":missing,"arm_sum":e.sum(axis=0).tolist()}
            rows.append(r)
            if np.any(ok) and key[0].startswith("Hairpin "):
                k=ARMS.index("history64")
                j=int(np.argmax(e[:,k]));idx=int(np.flatnonzero(ok)[j])
                candidate={"loss":float(e[j,k]),"id":g["ids"][idx],"key":key,"x":x[idx].tolist(),
                           "events":y[idx].tolist(),"probabilities":p[idx].tolist()}
                if worst is None or candidate["loss"]>worst["loss"]:worst=candidate
    o=summarize(rows);o.update(arms=ARMS,rows=rows,raw_worst=worst,prediction_sha256=filehash(lock))
    write_json(dest/"score.json",o);write_json(dest/"score-ledger.json",ledger)
    print("SCORE",json.dumps({k:o[k] for k in ("arms","mean","worst","gates","joint","raw_worst")}))

def main():
    a=argparse.ArgumentParser()
    a.add_argument("stage",choices=["donor","prefix","score"])
    a.add_argument("archive",type=Path);a.add_argument("dest",type=Path);a.add_argument("--input",type=Path);a.add_argument("--sha")
    args=a.parse_args();args.dest.mkdir(parents=True,exist_ok=True)
    if args.stage=="donor":donor(args.archive,args.dest)
    else:
        if filehash(args.input)!=args.sha:raise ValueError("Stage input hash")
        fn=predict if args.stage=="prefix" else score
        fn(args.archive,args.input,args.dest)
    for p in sorted(args.dest.iterdir()):
        if p.is_file():print("OUTPUT",p.name,p.stat().st_size,filehash(p))
if __name__=="__main__":main()
