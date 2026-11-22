#!/usr/bin/env python3
"""Reproduce the KUKA inverse-torque comparison from the organizer's prepared file."""
import argparse
import ctypes
import ctypes.util
import hashlib
import io
import json
from pathlib import Path
import tempfile
from urllib.request import urlopen

import numpy as np
from scipy.io import loadmat

from path_model import fit_points, path_starts


DIRECTORY = Path(__file__).parent
MAT_NAME = "inverse_identification_without_raw_data.mat"
RAR_NAME = "Robot_Identification_Benchmark_Without_Raw_Data.rar"
PUBLIC_URL = "https://fdm-fallback.uni-kl.de/TUK/FB/MV/WSKL/0001/" + RAR_NAME
RAR_SHA256 = "909523da90cc341257059faa6dd1fa18ffc64245df3191ea0014da0fb3c19bca"
MAT_SHA256 = "0615b1692bde550785a34f197880586c2cd4bc5faa61f5345d2fba2840b46ae4"
PATH_EDGES = [0,606,1212,1818,2424,3030,3636]


def check(data, expected):
    digest = hashlib.sha256(data).hexdigest()
    if digest != expected:
        raise ValueError(f"Source digest mismatch. Expected {expected}, received {digest}")
    return data


def extract_mat(path):
    """Read the named member in memory using the installed system libarchive."""
    library = ctypes.util.find_library("archive")
    if library is None:
        raise RuntimeError("Install libarchive or supply --mat with the extracted MAT file")
    lib = ctypes.CDLL(library)
    pointer,integer,chars = ctypes.c_void_p,ctypes.c_int,ctypes.c_char_p
    def bind(name, ret, *args):
        fn=getattr(lib,name);fn.restype=ret;fn.argtypes=list(args)
        return fn
    new=bind("archive_read_new",pointer)
    formats=bind("archive_read_support_format_all",integer,pointer)
    filters=bind("archive_read_support_filter_all",integer,pointer)
    open_file=bind("archive_read_open_filename",integer,pointer,chars,ctypes.c_size_t)
    next_entry=bind("archive_read_next_header",integer,pointer,ctypes.POINTER(pointer))
    name=bind("archive_entry_pathname",chars,pointer)
    size=bind("archive_entry_size",ctypes.c_longlong,pointer)
    read=bind("archive_read_data",ctypes.c_longlong,pointer,pointer,ctypes.c_size_t)
    skip=bind("archive_read_data_skip",integer,pointer)
    free=bind("archive_read_free",integer,pointer)
    handle=new()
    try:
        formats(handle);filters(handle)
        if open_file(handle,str(path).encode(),10240)!=0:
            raise ValueError("Unable to open prepared RAR")
        entry=pointer()
        while next_entry(handle,ctypes.byref(entry))==0:
            if name(entry).decode() == MAT_NAME:
                length=size(entry);buf=ctypes.create_string_buffer(length)
                if read(handle,buf,length)!=length:
                    raise ValueError("Incomplete prepared MAT member")
                return check(buf.raw,MAT_SHA256)
            skip(handle)
    finally:
        free(handle)
    raise ValueError("The prepared inverse MAT entry was not found")


def inputs(args):
    if args.mat:
        return check(args.mat.read_bytes(),MAT_SHA256)
    with tempfile.TemporaryDirectory() as temp:
        path=args.rar
        if path is None:
            path=Path(temp,RAR_NAME)
            with urlopen(PUBLIC_URL, timeout=90) as source:
                path.write_bytes(source.read())
        check(path.read_bytes(),RAR_SHA256)
        return extract_mat(path)


def v2_predict(X,Y,U):
    xm,ym=X.mean(0),Y.mean(0)
    sx,sy=X.std(0,ddof=1),Y.std(0,ddof=1)
    coef,_,rank,_=np.linalg.lstsq((X-xm)/sx,(Y-ym)/sy,rcond=None)
    if rank!=18:
        raise ValueError("The normalized published design is not full rank")
    return ((U-xm)/sx)@coef*sy+ym


def summarize(y,p):
    e=p-y
    nr=np.sqrt(np.mean(e**2,axis=0))/y.std(0,ddof=1)
    ix=np.argmax(abs(e),axis=0)
    return {"axis_nrmse":nr.tolist(),"mean_nrmse":float(nr.mean()),
            "worst_axis_nrmse":float(nr.max()),"max_absolute_Nm":float(np.max(abs(e))),
            "worst_by_axis":[{"row":int(k),"joint":j+1,"recorded_Nm":float(y[k,j]),
                              "predicted_Nm":float(p[k,j])} for j,k in enumerate(ix)]}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    src=parser.add_mutually_exclusive_group()
    src.add_argument("--mat",type=Path,help="Exact extracted inverse-identification MAT")
    src.add_argument("--rar",type=Path,help="Exact organizer archive without raw recordings")
    parser.add_argument("--all-controls",action="store_true",help="Refit the Gaussian kernel and seven neural controls")
    parser.add_argument("--details",action="store_true",help="Include all six traversal summaries")
    parser.add_argument("--check", action="store_true",
                        help="Require mean, axis and design NRMSE to reproduce within 1e-7")
    args=parser.parse_args()
    raw=inputs(args)
    # No held output array is decoded during the model fit or prediction.
    data=loadmat(io.BytesIO(raw),variable_names=["u_train","y_train","u_test"])
    X,Y,U=data["u_train"].T,data["y_train"].T,data["u_test"].T
    if X.shape!=(39988,18) or Y.shape!=(39988,6) or U.shape!=(3636,18):
        raise ValueError("Unexpected source shape")
    ts,us=path_starts(11),path_starts(1)
    if list(us)!=PATH_EDGES[:-1]:
        raise ValueError("Held traversal boundaries changed")
    registered=json.loads((DIRECTORY/"frozen_registry.json").read_text())
    authored=json.loads((DIRECTORY/"released_v1_weights.json").read_text())
    models={"author-v2":v2_predict(X,Y,U),"author-v1-weights":U@np.asarray(authored["weights"]).T}
    for kind in ["released","filter","position"]:
        models["basis-"+kind],_=fit_points(X,Y,U,ts,us,kind)
    if args.all_controls:
        from kernel_control import fit_kernel
        from torque_model import predict_torch
        models["nystrom"]=fit_kernel(X,Y,U,ts,us)
        for arm in ["snapshot","history","history-differences","filter-mlp",
                    "released-structural","position-structural","filter-structural"]:
            models[arm],_=predict_torch(X,Y,U,arm,ts,us)
    # The originally scored external arrays were frozen in the registry.
    # This command explicitly reports whether a recomputation is byte exact.
    replay={}
    for arm,pred in models.items():
        b=io.BytesIO();np.save(b,pred);h=hashlib.sha256(b.getvalue()).hexdigest()
        replay[arm]={"computed":h,"matches_original":h==registered["predictions"][arm]["sha256"]}
    held=loadmat(io.BytesIO(raw),variable_names=["y_test"])["y_test"].T
    scores={}
    intervals=list(zip(PATH_EDGES[:-1],PATH_EDGES[1:]))
    for arm,pred in models.items():
        groups=[]
        for j in range(3):
            idx=np.r_[np.arange(*intervals[j]),np.arange(*intervals[j+3])]
            groups.append(summarize(held[idx],pred[idx])["mean_nrmse"])
        score=summarize(held,pred);score["three_design_nrmse"]=groups
        if args.details:
            score["traversals"]=[summarize(held[a:b],pred[a:b]) for a,b in intervals]
        scores[arm]=score
    primary=scores["basis-position"];neighbor=scores["basis-filter"];author=scores["author-v2"]
    gate={"mean_beats_preselected_comparator":primary["mean_nrmse"]<neighbor["mean_nrmse"],
          "worst_axis_beats_preselected_comparator":primary["worst_axis_nrmse"]<neighbor["worst_axis_nrmse"],
          "all_designs_beat_author_v2":all(a<b for a,b in zip(primary["three_design_nrmse"],author["three_design_nrmse"]))}
    expected=json.loads((DIRECTORY/"comparison.json").read_text())["per_arm"]
    deltas={}
    for arm, observed in scores.items():
        original=expected[arm]
        left=[observed["mean_nrmse"],*observed["axis_nrmse"],*observed["three_design_nrmse"]]
        right=[original["pooled"]["mean_nrmse"],*original["pooled"]["axis_nrmse"],*original["design_means"]]
        deltas[arm]=float(np.max(np.abs(np.asarray(left)-right)))
    print(json.dumps({"max_nrmse_replay_delta":deltas,"rows":len(held),"motor_torques":int(held.size),"primary_gate":gate,
                      "primary_joint":all(gate.values()),"scores":scores,"replay":replay},sort_keys=True,indent=2))
    if args.check and (not all(gate.values()) or max(deltas.values())>1e-7):
        raise SystemExit("Recomputed scientific metrics differ from the original frozen forecast course")


if __name__=="__main__":
    main()
