"""Reproduce the opened cells from named physical HDF5 rows or digest-checked cached rows."""
import argparse
import concurrent.futures
import hashlib
import json
import pathlib
import tempfile
import zipfile

import h5py
import numpy as np

from archive_access import RangeFile,subfile
from transport import templates,score_case


def source_file(manifest,cache):
    meta=manifest["source"];size=meta["size"]
    url="https://ndownloader.figshare.com/files/"+str(meta["id"])
    reader=RangeFile(url,size)
    with zipfile.ZipFile(reader) as z:
        members=sorted((x for x in z.infolist() if x.filename.endswith("/pc_f40kHz.h5")),key=lambda x:x.filename)
    assert len(members)==322
    assert all(x.filename==r["name"] for x,r in zip(members,manifest["clock"]))
    order=manifest["order"];paths=manifest["paths"]
    def read_capture(ordinal):
        x=members[ordinal];assert x.compress_type==zipfile.ZIP_STORED
        member={"offset":x.header_offset,"size":x.file_size}
        view=subfile(RangeFile(url,size),member)
        with h5py.File(view,"r") as h:
            channels=(h["command/pitchcatch/channels"][:]+1).tolist()
            assert len(channels)==66 and h["pitchcatch/catch"].shape==(66,13108)
            assert (h["command/pitchcatch/sampling_frequency"][0],h["command/pitchcatch/signal_frequency"][0],h["command/pitchcatch/signal_cycles"][0])==(1e7,40000,5)
            record=manifest["clock"][ordinal]
            for key,dataset in [("surface","Temperature/values"),("timestamp","timestamp"),("temperature","CTC/Temperature"),("rh","CTC/Humidity")]:
                assert h[dataset][:].tolist()==record[key]
            # Read the named physical row by the HDF5-verified contiguous layout.
            ds=h["pitchcatch/catch"];assert ds.chunks is None and ds.compression is None and ds.dtype.str=="<f8"
            offset=ds.id.get_offset();size_row=ds.shape[1]*ds.dtype.itemsize
            out=[]
            for pair in paths:
                row=channels.index(pair);view.remote.seek(view.begin+offset+row*size_row)
                data=view.remote.read(size_row)
                out.append(np.frombuffer(data,dtype=ds.dtype).copy())
            return np.stack(out)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        values=np.stack(list(pool.map(read_capture,order)))
    np.savez_compressed(cache,ordinals=order,channels=paths,signals=values)


def gate(matrix,methods):
    i=methods.index("phase");others=[j for j in range(len(methods)) if j!=i]
    means=matrix.mean(axis=(0,1));maximum=matrix[:,:,:,2].max(axis=(0,1))
    per_path=matrix[:,:,:,2].mean(axis=1)
    ratios=dict(carrier=float(means[i,2]/min(means[others,2])),above5k=float(means[i,1]/min(means[others,1])),
                worst=float(maximum[i]/min(maximum[others])),paths=(per_path[:,i]/per_path[:,others].min(axis=1)).tolist())
    passed=ratios["carrier"]<=.95 and ratios["above5k"]<=1. and ratios["worst"]<=1.05 and max(ratios["paths"])<=1.05
    return ratios,bool(passed)


def run(manifest_path,cache):
    m=json.loads(manifest_path.read_bytes());order=list(range(81))+list(range(81,160,2))
    paths=[[i,i+6] for i in range(1,7)]+[[4,9]]
    assert m["order"]==order and m["paths"]==paths
    methods=["raw_author","offset_only","low_band_only","band_author","observed","average","quadratic","phase"]
    assert m["methods"]==methods
    if not cache.exists(): source_file(m,cache)
    with np.load(cache,allow_pickle=False) as f:
        assert f["channels"].tolist()==paths and f["ordinals"].tolist()==order
        signals=f["signals"]
    assert signals.shape==(121,7,13108)
    src=m["input_trace_sha_ordered_by_path"]
    for j,(tx,rx) in enumerate(paths):
        for i,o in enumerate(order):
            expected=src[j*121+i]
            assert (o,tx,rx)==(expected["ordinal"],expected["tx"],expected["rx"])
            assert hashlib.sha256(signals[i,j].astype("<f8",copy=False).tobytes()).hexdigest()==expected["sha256"]
    surface=np.array([np.mean(r["surface"]) for r in m["clock"][:81]])
    values=np.empty((7,40,8,3))
    for j,(tx,rx) in enumerate(paths):
        bank=signals[:81,j];reps=templates(bank,surface)
        for k,o in enumerate(order[81:]):
            scores,_=score_case(bank,reps,signals[81+k,j])
            expected=m["rows_path_major"][j*40+k]
            assert expected[:3]==[o,tx,rx]
            values[j,k]=[[scores[method][name] for name in ("raw","above5k","carrier")] for method in methods]
            np.testing.assert_allclose(values[j,k],expected[3:],rtol=2e-7,atol=1e-12)
        print("verified path",tx,rx,flush=True)
    ratios,passed=gate(values,methods)
    assert passed is False and m["summary"]["passed"] is False
    print(json.dumps({"verified_source_rows":847,"cases":280,"arm_waveforms":2240,"score_values":6720,"gate":passed,"ratios":ratios},sort_keys=True))


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-cache",type=pathlib.Path,help="existing or new NPZ of the registered 847 physical rows")
    args=parser.parse_args()
    with tempfile.TemporaryDirectory() as temp:
        run(pathlib.Path(__file__).with_name("frozen-results.json"),args.source_cache or pathlib.Path(temp)/"sources.npz")
