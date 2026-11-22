import argparse
import hashlib
import json
import time
from pathlib import Path

import h5py
import numpy as np
from parallax import ARMS, BINS, run
from projective import projective_loss, synthetic_controls


def sha(path):
    h=hashlib.sha256()
    with path.open("rb") as reader:
        while block:=reader.read(4*1024*1024):
            h.update(block)
    return h.hexdigest()


def write_json(path,data):
    path.write_text(json.dumps(data,sort_keys=True,indent=2,allow_nan=False)+"\n")


def index(source):
    with h5py.File(source) as f:
        raw=f["SourcePosition"][...]
        assert f["SourcePosition"].attrs["Type"]==b"spherical"
        assert f["SourcePosition"].attrs["Units"]==b"degree, degree, metre"
        assert tuple(f["Data.IR"].shape[1:])==(2,256)
        assert np.array_equal(f["Data.SamplingRate"][...],[48000])
        assert np.array_equal(f["Data.Delay"][...],[[0,0]])
        assert np.array_equal(f["ReceiverPosition"][...].squeeze(),[[0,.09,0],[0,-.09,0]])
        assert np.array_equal(f["ListenerView"][...],[[1,0,0]])
        assert np.array_equal(f["ListenerUp"][...],[[0,0,1]])
        data=raw*np.array([1,1,1000])
        integral=np.rint(data)
        if np.max(abs(data-integral))>1e-9:
            raise ValueError("off-grid positions")
        keys=integral.astype(int)
        keys[:,0]%=360
        result={tuple(k):i for i,k in enumerate(keys)}
        if len(result)!=len(keys):
            raise ValueError("duplicate positions")
        return result


def read_response(source, indices):
    arr=np.empty((len(indices),len(BINS),2),dtype=complex)
    order=np.argsort(indices)
    indices=np.asarray(indices)
    with h5py.File(source) as f:
        bank=f["Data.IR"]
        for ids in np.array_split(order,max(1,(len(order)+127)//128)):
            pulses=bank[indices[ids],:,:]
            if not np.isfinite(pulses).all():
                raise ValueError("nonfinite input IR")
            arr[ids]=np.fft.rfft(pulses,axis=2)[:,:,BINS].transpose(0,2,1)
    return arr


def cohort(keys):
    pos=np.array(keys,dtype=int)
    a,e,r=pos.T
    train=pos[((a%20==0)|(a%20==10))&(r>=750)]
    dev=pos[(a%20==5)&(r>=540)&(r<750)]
    held=pos[(a%20==15)&(r<=510)]
    assert [len(x) for x in (train,dev,held)]==[5616,1638,1872]
    return train,dev,held


def read_at(source,map_,keys):
    return read_response(source,[map_[tuple(k)] for k in keys])


def score(truth,pred,keys):
    losses=projective_loss(truth,pred)
    nnull=int(np.isnan(losses).sum())
    if np.isinf(losses).any() or np.any(np.all(np.isnan(losses),axis=1)):
        raise ValueError("no identifiable frequencies at a coordinate")
    per_point=np.nanmean(losses,axis=1)
    groups={}
    for i,key in enumerate(keys):
        groups.setdefault(tuple(map(int,key[:2])),[]).append(i)
    per_sweep={str(k):float(np.mean(per_point[rows])) for k,rows in groups.items()}
    point, freq=np.unravel_index(np.nanargmax(losses),losses.shape)
    describe=lambda z:[[float(c.real),float(c.imag)] for c in z]
    row={"geometry":keys[point].tolist(),"frequency_Hz":float(BINS[freq]*48000/256),
         "loss":float(losses[point,freq]),"observed_LR":describe(truth[point,freq]),"predicted_LR":describe(pred[point,freq])}
    return {"equal_sweep_mean":float(np.mean(list(per_sweep.values()))),"worst_sweep":max(per_sweep.values()),"sweep_loss":per_sweep,
            "measured_joint_nulls":nnull,"raw_worst":row}


def main():
    p=argparse.ArgumentParser()
    for arg in ("phase","source","output","schema"): p.add_argument(arg)
    p.add_argument("--ports",choices=["dev","held"],default="dev")
    p.add_argument("--lock")
    args=p.parse_args()
    if args.phase not in ("freeze","score"): raise ValueError(args.phase)
    root=Path(args.source);out=Path(args.output);out.mkdir(exist_ok=True)
    schema=Path(args.schema)
    assert sha(schema)=="cdd0f19143b4e47e6046e4d32dfb7928532fa89cd7b94ccec7daa9d6fcd5c97c"
    registry=json.loads(schema.read_text())
    sources=[root/f for f in sorted(registry)]
    assert len(sources)==2
    for path in sources:
        assert sha(path)==registry[path.name]["sha256"]
    m,s=map(index,sources)
    universe=sorted(m.keys()&s.keys());assert len(universe)==25272
    train,dev,held=cohort(universe)
    outkeys=dev if args.ports=="dev" else held
    lock=out/("forecasts-"+args.ports+".npz")
    if args.phase=="freeze":
        if lock.exists(): raise FileExistsError(lock)
        start=time.monotonic()
        y=read_at(sources[0],m,train)
        f=read_at(sources[1],s,train)
        fs=read_at(sources[1],s,outkeys)
        arm,chosen=run(train,y,f,outkeys,fs)
        assert set(arm)==set(ARMS)
        np.savez_compressed(lock,keys=outkeys,**arm)
        write_json(out/("freeze-"+args.ports+".json"),{"sha256":sha(lock),"bytes":lock.stat().st_size,
                "selected_lambda":chosen,"synthetic_crop_witness":synthetic_controls(),"fit_and_forecast_s":time.monotonic()-start,
                "measured_training_rows":len(train),"measured_target_rows":0,"simulated_training_rows":len(train),
                "simulated_forecast_rows":len(outkeys),"arms":list(ARMS)})
    else:
        if not args.lock or sha(lock)!=args.lock: raise ValueError("unverified forecast archive")
        truth=read_at(sources[0],m,outkeys)
        np.savez_compressed(out/("outcomes-"+args.ports+".npz"),keys=outkeys,truth=truth)
        with np.load(lock,allow_pickle=False) as obj:
            assert sorted(obj.files)==sorted(("keys",*ARMS))
            assert np.array_equal(outkeys,obj["keys"])
            results={arm:score(truth,obj[arm],outkeys) for arm in ARMS}
        gates={metric:all(results["ear_local"][metric]<results[arm][metric] for arm in ARMS if arm!="ear_local") for metric in ("equal_sweep_mean","worst_sweep")}
        ident=results["ear_local"]["measured_joint_nulls"]==0
        write_json(out/("score-"+args.ports+".json"),{"results":results,"beat_every_comparator":gates,"all_identifiable":ident,
                "pass":ident and all(gates.values()),"coordinates":len(outkeys),"frequencies":len(BINS),"locked_sha256":args.lock})


if __name__=="__main__":
    main()
