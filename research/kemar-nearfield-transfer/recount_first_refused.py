import argparse
import hashlib
import json
import math
from pathlib import Path

import h5py
import numpy as np


ARMS = ("author_fem", "neighbor_measured", "neighbor_fem_residual", "ear_local",
        "head_centered", "head_inverse_radius", "global_ear_gain")
BINS = np.arange(3, 43)


def recount(measured_file, forecast_file, score_file, native_outcomes, section):
    md5 = hashlib.md5()
    sha256 = hashlib.sha256()
    with measured_file.open("rb") as inp:
        for block in iter(lambda:inp.read(4*1024*1024), b""):
            md5.update(block)
            sha256.update(block)
    assert md5.hexdigest()=="8e286f7f2ffa67973bb0eb2e37c158e2"
    assert sha256.hexdigest()=="0bda73c4c80233502421adf7c8c2aafddfbe00a6a734cbdd3160bbb9001bbf88"
    published=json.loads(score_file.read_text())
    assert hashlib.sha256(forecast_file.read_bytes()).hexdigest()==published["locked_sha256"]
    with h5py.File(measured_file) as m:
        coordinates=np.rint(m["SourcePosition"][...] * [1,1,1000]).astype(int)
        mask = (coordinates[:,0]%20 == (5 if section=="dev" else 15))
        if section=="dev":
            mask &= (coordinates[:,2]>=540)&(coordinates[:,2]<=720)
        else:
            mask &= (coordinates[:,2]>=300)&(coordinates[:,2]<=510)
        ids=np.flatnonzero(mask)
        assert len(ids)==(1638 if section=="dev" else 1872)
        ordered=np.lexsort((coordinates[ids,2],coordinates[ids,1],coordinates[ids,0]))
        coords=coordinates[ids][ordered]
        # Explicit roots of unity, independent of producer rFFT and scorer.
        matrix=np.exp((-2j*np.pi/256)*np.outer(np.arange(256),BINS))
        blocks=[]
        with np.errstate(over="raise"):
            for group in np.array_split(ids,math.ceil(len(ids)/120)):
                blocks.append(m["Data.IR"][group] @ matrix)
        y=np.concatenate(blocks)[ordered].transpose(0,2,1)
    with np.load(native_outcomes,allow_pickle=False) as bundle:
        assert np.array_equal(bundle["keys"],coords)
        original_y=bundle["truth"]
    assert np.allclose(y,original_y,rtol=1e-10,atol=1e-10)
    fields={}
    with np.load(forecast_file,allow_pickle=False) as z:
        assert set(z.files)=={"keys",*ARMS} and np.array_equal(z["keys"],coords)
        e0=np.sum(np.abs(y)**2,axis=2)
        assert np.all(e0>0)
        for arm in ARMS:
            p=z[arm]
            e1=np.sum(np.abs(p)**2,axis=2)
            overlap=np.abs(np.sum(y.conj()*p,axis=2))**2
            delta = 1 - np.divide(overlap,e0*e1,out=np.zeros_like(e0),where=e1>0)
            delta=np.clip(delta,0,1)
            origin_power=np.sum(np.abs(original_y)**2,axis=2)
            det=np.abs(original_y[:,:,0]*p[:,:,1]-original_y[:,:,1]*p[:,:,0])**2
            producer_delta=np.divide(det,origin_power*e1,out=np.ones_like(e0),where=e1>0)
            max_point_error=float(np.max(np.abs(delta-producer_delta)))
            assert max_point_error<1e-9
            groups={}
            for k,(a,e,r) in enumerate(coords):
                groups.setdefault((int(a),int(e)),[]).append(k)
            means={str(key):float(np.mean(delta[rows,:])) for key,rows in groups.items()}
            pub=published["results"][arm]
            assert set(means)==set(pub["sweep_loss"])
            max_group_error=max(abs(v-pub["sweep_loss"][k]) for k,v in means.items())
            overall=math.fsum(means.values())/len(means)
            worst=max(means.values())
            assert math.isclose(overall,pub["equal_sweep_mean"],rel_tol=1e-11,abs_tol=1e-12)
            assert math.isclose(worst,pub["worst_sweep"],rel_tol=1e-11,abs_tol=1e-12)
            assert max_group_error<1e-11
            i,j=np.unravel_index(np.argmax(delta),delta.shape)
            raw=pub["raw_worst"]
            assert raw["geometry"]==coords[i].tolist()
            assert raw["frequency_Hz"]==float(BINS[j]*48000/256)
            assert abs(raw["loss"]-delta[i,j])<1e-10
            ref=np.array(raw["observed_LR"]) @ np.array([1,1j])
            assert np.allclose(y[i,j],ref,rtol=1e-10,atol=1e-10)
            fields[arm]={"mean":overall,"max_sweep_mean":worst,"max_sweep_disagreement":max_group_error,"max_bin_disagreement":max_point_error,"worst_coordinate":raw["geometry"],"worst_frequency":raw["frequency_Hz"]}
    joint=all(fields["ear_local"][key]<v[key] for key in ("mean","max_sweep_mean") for k,v in fields.items() if k!="ear_local")
    assert joint==published["pass"]
    return {"section":section,"per_arm_complex_points":len(coords)*40,"arms":fields,"joint":joint,"source_sha256":sha256.hexdigest(),"source_md5":md5.hexdigest()}


if __name__=="__main__":
    import sys
    inp,forecasts,scores,native_outcomes,section,out=sys.argv[1:]
    Path(out).write_text(json.dumps(recount(Path(inp),Path(forecasts),Path(scores),Path(native_outcomes),section),indent=2,sort_keys=True)+"\n")
