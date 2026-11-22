"""Read only author code and metadata, never trial arrays. Run the source VQF on artificial input."""
import hashlib
import importlib.util
import json
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation

BROAD="7e2f8189bb4a3ac91eae32c69b6bc87f08a6e2ad"
VQF="86ba56bdd3158b9b05f9f9fe5596866ba326438c"


def get(project,pin,path,expected):
    url=f"https://raw.githubusercontent.com/dlaidig/{project}/{pin}/{path}"
    with urllib.request.urlopen(url,timeout=30) as f: b=f.read()
    blob=hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
    assert blob==expected
    return b


def rank_test(rotations):
    b=np.array([17.,-22.,8.]);ambient=np.array([18.,5.,-42.])
    q=rotations.as_matrix();m=np.einsum("nij,j->ni",q,ambient)+b
    design=(np.eye(3)-q).reshape(-1,3);rhs=(m-np.einsum("nij,j->ni",q,ambient+b)).reshape(-1)
    u,s,v=np.linalg.svd(design,full_matrices=False)
    fit=np.linalg.lstsq(design,rhs,rcond=1e-12)[0]
    rank=int(np.sum(s>s[0]*1e-12))
    return dict(rank=rank,singular_values=s.tolist(),unobservable_dim=3-rank,fit_error=float(np.linalg.norm(fit-b)),max_measurement_error=float(abs(design@fit-rhs).max()))


def main():
    blobs={
      "protocol":get("broad",BROAD,"data_hdf5/trials.json","ec696c67880c6b2e05c288f8eb8f4cf0852be287"),
      "scorer":get("broad",BROAD,"example_code/broad_utils.py","42cb7e7852eaedf79b066585ca0f9c2a7cca516b"),
      "official_runner":get("broad",BROAD,"example_code/process_data.py","729556c21fcc37ebd60a956aff303c3208313e8d"),
      "PyVQF":get("vqf",VQF,"vqf/pyvqf.py","5084f77e7871f97e3fca7adc45ce9a94b24a2dd5"),
    }
    trials=json.loads(blobs['protocol'])['trials']
    with tempfile.TemporaryDirectory() as d:
        p=Path(d)/"source_vqf.py";p.write_bytes(blobs["PyVQF"])
        spec=importlib.util.spec_from_file_location("source_vqf",p);mod=importlib.util.module_from_spec(spec);sys.modules[spec.name]=mod;spec.loader.exec_module(mod)
        n=401
        est=mod.PyVQF(1/400);r=est.updateBatch(np.zeros((n,3)),np.tile([0.,0.,9.81],(n,1)),np.tile([0.,20.,-42.],(n,1)))
        norm=np.linalg.norm(r["quat9D"],axis=1);assert np.max(abs(norm-1))<1e-10
    print(json.dumps(dict(source_hashes={k:hashlib.sha256(v).hexdigest() for k,v in blobs.items()},BROAD=BROAD,VQF_v2_1_2=VQF,official_trials=len(trials),stationary_room=[k for k in trials if "stationary_magnet" in k],attached_board=[k for k in trials if "attached_magnet" in k],actual_trial_sensor_or_optical_arrays_read=0,
          synthetic_author_vqf_samples=n,synthetic_quat_max_norm_error=float(abs(norm-1).max()),
          one_axis=rank_test(Rotation.from_euler("z",np.linspace(0,1.8,15))),three_axis=rank_test(Rotation.from_rotvec(np.array([[0,0,0],[1,0,0],[0,1,0],[0,0,1],[.3,-.6,.2]])))),sort_keys=True))


if __name__=="__main__":main()
