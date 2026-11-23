import hashlib,json,pathlib,tempfile,urllib.request,sys,shutil
import h5py,numpy as np
from refnx.reduce import SpatzReduce
HASHES={"SPZ0003470.nx.hdf":"123021d6e7cbecebece0c7fb50385350288544d7ef2e03711a73fcbbfb7b74f7","SPZ0003471.nx.hdf":"e421b3ddd74e0e87ed0d406ee341e91caaf8c01fff2018952b3ad303042b9b5c","SPZ0003472.nx.hdf":"3624467fc15df72baa19c9b4c2515614e16abf381f27a95f93ba623327214c97","SPZ0003493.nx.hdf":"bfbfea99e137ee208271ebca90c0fccc5c3255be122cfbdf67257af4368d10e9","SPZ0003494.nx.hdf":"3c90d3228d08a578d626b4664656005bedb402e4882fdfc5cc37e3b2b306ac02","SPZ0003495.nx.hdf":"8c38cb6142c33191a8cf1d8ddab3d525a9889f3e53af8fd95978a8e06f106429","SPZ0003496.nx.hdf":"276b795b39f6b73f5c4433d3a35b99485621d4d4713df9f821183c499d2b8021","SPZ0003497.nx.hdf":"ca9b2a05f688a9cd282cf9b6287c56a7b7f6ee72f4965d799f100f03cbde7dc4","SPZ0003498.nx.hdf":"83a518dabe79986c6dabe143884cd633bd5ec01151c542f5763717aa833201f2","SPZ0003499.nx.hdf":"108fa988bcfa1fb72f6258dfbf7705d67c30ecf9c67507eaa0c9056d368c8c1e","SPZ0003500.nx.hdf":"57d687f3b4c6aef40a56cf74c7caa0038a604c82b57a1afe345afeda9d9f25ac","SPZ0003501.nx.hdf":"4bc40591e544ee656b64e57cc2fed38db9a62d7e2e6415f7c4c38e2b49c0d68b"}
PAIR={3493:3471,3494:3472,3495:3470,3496:3471,3497:3472,3498:3471,3499:3472,3500:3471,3501:3472}
BEAM={"3470":[443.5326089470546,7.886725186054432],"3471":[442.6686515963895,8.130886004814009],"3472":[442.4385683208974,11.905339312459331]}
def receive(root):
    for name,digest in HASHES.items():
        path=root/name
        if not path.exists():
            u="https://zenodo.org/api/records/6829895/files/"+name+"/content"
            with urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":"WORLDLAW-Sci/Spatz-raw"}),timeout=100) as f:
                data=f.read(1000001)
            if hashlib.sha256(data).hexdigest()!=digest:raise ValueError("Source hash "+name)
            path.write_bytes(data)
        elif hashlib.sha256(path.read_bytes()).hexdigest()!=digest:
            raise ValueError("Cached hash "+name)
def single(root,n,design=False):
    direct=PAIR[n]
    d=root/("SPZ%07d.nx.hdf"%direct)
    name="SPZ%07d.nx.hdf"%n
    p=root/name
    if design:
        # Make an opaque copy, then overwrite every detector count using only the
        # independent direct exposure before giving the surrogate to the reducer.
        tmp=pathlib.Path(tempfile.mkdtemp(prefix="spatz-surrogate-"))/name
        shutil.copyfile(p,tmp)
        with h5py.File(tmp,"r+") as out,h5py.File(d,"r") as inp:
            for path in ("entry1/data/hmm","entry1/data/total_counts","entry1/instrument/detector/max_binrate","entry1/instrument/detector/total_maprate","entry1/monitor/bm1_counts"):
                if path in out and path in inp:out[path][...]=inp[path][...]
        p=tmp
    center,width=BEAM[str(direct)]
    red=SpatzReduce(str(d))
    datasets,info=red.reduce(str(p),save=False,scale=1.0,lo_wavelength=2.8,hi_wavelength=18.0,rebin_percent=3.4,peak_pos=(center,width),background=True,normalise=True)
    scan=datasets[0]
    order=np.argsort(scan.x,kind="stable")
    result={"q":np.asarray(scan.x)[order].tolist(),"fwhm":np.asarray(scan.x_err)[order].tolist()}
    if not design:result.update(R=np.asarray(scan.y)[order].tolist(),dR=np.asarray(scan.y_err)[order].tolist())
    if design:
        p.unlink()
        p.parent.rmdir()
    return result

def project(root,selected,designs):
    data={}
    for n in selected:
        entry=single(root,n)
        for key in ("q","fwhm"):
            if not np.allclose(entry[key],designs[str(n)][key],rtol=1e-11,atol=1e-13):
                raise ValueError(f"{n} {key} differs from input-only design")
        if not all(np.all(np.isfinite(entry[key])) for key in ("R","dR")) or min(entry["dR"])<0:
            raise ValueError(f"{n} invalid measurement or statistical error")
        data[str(n)]=entry
    return data
