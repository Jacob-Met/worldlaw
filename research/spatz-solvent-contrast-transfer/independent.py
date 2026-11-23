"""Independently recount unstitched measured ratios and every comparative gate.

The comparison uses only the published refnx reduction routine and Python scalar
arithmetic. The producer's projector, fitter, interval constructor and scorer
are not imported.
"""
import hashlib
import json
import math
import pathlib
import urllib.request
import zlib

import numpy as np
from refnx.reduce import SpatzReduce

DIRECTS={3493:3471,3494:3472,3495:3470,3496:3471,3497:3472,3498:3471,3499:3472,3500:3471,3501:3472}
WINDOWS={3470:(443.5326089470546,7.886725186054432),3471:(442.6686515963895,8.130886004814009),3472:(442.4385683208974,11.905339312459331)}
SOURCE={"SPZ0003470.nx.hdf":"123021d6e7cbecebece0c7fb50385350288544d7ef2e03711a73fcbbfb7b74f7","SPZ0003471.nx.hdf":"e421b3ddd74e0e87ed0d406ee341e91caaf8c01fff2018952b3ad303042b9b5c","SPZ0003472.nx.hdf":"3624467fc15df72baa19c9b4c2515614e16abf381f27a95f93ba623327214c97","SPZ0003493.nx.hdf":"bfbfea99e137ee208271ebca90c0fccc5c3255be122cfbdf67257af4368d10e9","SPZ0003494.nx.hdf":"3c90d3228d08a578d626b4664656005bedb402e4882fdfc5cc37e3b2b306ac02","SPZ0003495.nx.hdf":"8c38cb6142c33191a8cf1d8ddab3d525a9889f3e53af8fd95978a8e06f106429","SPZ0003496.nx.hdf":"276b795b39f6b73f5c4433d3a35b99485621d4d4713df9f821183c499d2b8021","SPZ0003497.nx.hdf":"ca9b2a05f688a9cd282cf9b6287c56a7b7f6ee72f4965d799f100f03cbde7dc4","SPZ0003498.nx.hdf":"83a518dabe79986c6dabe143884cd633bd5ec01151c542f5763717aa833201f2","SPZ0003499.nx.hdf":"108fa988bcfa1fb72f6258dfbf7705d67c30ecf9c67507eaa0c9056d368c8c1e","SPZ0003500.nx.hdf":"57d687f3b4c6aef40a56cf74c7caa0038a604c82b57a1afe345afeda9d9f25ac","SPZ0003501.nx.hdf":"4bc40591e544ee656b64e57cc2fed38db9a62d7e2e6415f7c4c38e2b49c0d68b"}
TRAIN=(3493,3494,3500,3501)
TEST=(3495,3496,3497,3498,3499)
ARMS=("shared_disk","author_solvated_slabs","author_free_backing","dry_slabs","linear_SLD","asinh_SLD","nearest_contrast")
MEDIA={"CM4":(3495,3496,3497),"CMSi":(3498,3499)}

def checked(condition,message):
    if not condition:
        raise ValueError(message)

def rms(v):
    return math.sqrt(math.fsum(x*x for x in v)/len(v))

def obtain(root):
    root.mkdir(parents=True,exist_ok=True)
    for name,sha in SOURCE.items():
        target=root/name
        if not target.exists():
            url=f"https://zenodo.org/api/records/6829895/files/{name}/content"
            with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"WORLDLAW-Spatz-independent-replay/1.0"}),timeout=100) as f:
                data=f.read(1000001)
            checked(hashlib.sha256(data).hexdigest()==sha,name)
            target.write_bytes(data)
        checked(hashlib.sha256(target.read_bytes()).hexdigest()==sha,name)

def unpack(path,digest):
    data=zlib.decompress(path.read_bytes())
    checked(hashlib.sha256(data).hexdigest()==digest,str(path))
    return json.loads(data)

def evaluate(root,bank,outcome):
    obtain(root)
    all_scans={}
    discrepancies=[]
    per_scan={}
    witnesses={}
    for scan,direct in DIRECTS.items():
        get=lambda n:root/(f"SPZ{n:07}.nx.hdf")
        reducer=SpatzReduce(str(get(direct)))
        dataset,_=reducer.reduce(str(get(scan)),save=False,scale=1.0,
            lo_wavelength=2.8,hi_wavelength=18.0,rebin_percent=3.4,
            peak_pos=WINDOWS[direct],background=True,normalise=True)
        ds=dataset[0]
        order=np.argsort(ds.x)
        arrays={k:np.asarray(a)[order] for k,a in zip(("q","R","dR","fwhm"),(ds.x,ds.y,ds.y_err,ds.x_err))}
        truth=(bank["calibration"] if scan in TRAIN else outcome["truth"])[str(scan)]
        for name,data in arrays.items():
            delta=np.max(np.abs(data-np.asarray(truth[name])))
            discrepancies.append(float(delta))
            checked(np.allclose(data,truth[name],rtol=3e-10,atol=3e-12),f"{name} {scan}")
        # The native m_spec wavelength order is opposite the public, sorted Q
        # order. Match each reduced wavelength to Q through the actual omega.
        ref=reducer.reflected_beam
        db=reducer.direct_beam
        pixel_q=4*np.pi*np.sin(np.radians(np.asarray(reducer.omega_corrected)[0]))/np.asarray(ref.m_lambda)[0]
        pos=np.argsort(pixel_q)
        checked(np.allclose(pixel_q[pos],arrays["q"],rtol=2e-10,atol=2e-12),"wavelength-Q map")
        signal=np.asarray(ref.m_spec).reshape(-1)[pos]
        incident=np.asarray(db.m_spec).reshape(-1)[pos]
        checked(np.all(incident>0),"nonpositive denominator")
        checked(np.allclose(signal/incident,arrays["R"],rtol=2e-10,atol=2e-12),"raw ratio")
        all_scans[scan]=arrays
        if scan in TRAIN:
            continue
        pred=bank["points"][str(scan)]
        checked(set(pred)==set(ARMS),"arm roster")
        per_scan[scan]={}
        for arm in ARMS:
            err=[math.asinh(p/1e-5)-math.asinh(t/1e-5) for p,t in zip(pred[arm],arrays["R"])]
            per_scan[scan][arm]=rms(err)
            refscore=outcome["score"]
            checked(abs(per_scan[scan][arm]-refscore["by_scan"][str(scan)][arm])<2e-10,"score")
            j=max(range(len(err)),key=lambda i:abs(err[i]))
            rr=refscore["raw_and_worst"][str(scan)][arm]
            checked(j==rr["index"] and abs(rr["asinh_error"]-err[j])<2e-10,"worst")
            raw_rmse=rms([p-t for p,t in zip(pred[arm],arrays["R"])])
            checked(abs(raw_rmse-rr["raw_rmse"])<2e-10,"raw RMSE")
            if arm=="shared_disk":
                witnesses[scan]={"row":j,"q":float(arrays["q"][j]),
                    "measured_ratio":float(arrays["R"][j]),"dR":float(arrays["dR"][j]),
                    "monitor_normalized_reflected_spectrum":float(signal[j]),
                    "monitor_normalized_direct_spectrum":float(incident[j]),
                    "predictions":{k:float(pred[k][j]) for k in ARMS}}
    by_group={g:{arm:math.fsum(per_scan[n][arm] for n in ns)/len(ns) for arm in ARMS} for g,ns in MEDIA.items()}
    gates={g+"/"+k:a["shared_disk"]<a[k] for g,a in by_group.items() for k in ARMS if k!="shared_disk"}
    checked(gates==outcome["score"]["gates"],"gates")
    incompatible=[]
    for n in TRAIN:
        for j,(r,dr) in enumerate(zip(all_scans[n]["R"],all_scans[n]["dR"])):
            if r-3*dr>1 or r+3*dr<0:
                incompatible.append([n,j])
    checked(incompatible==[row[:2] for row in bank["envelopes"]["outside_physical_training"]],"range refusal")
    # A single inadmissible training row empties the registered joint system.
    checked(bool(incompatible) and outcome["score"]["interval_joint"] is False,"missing global refusal")
    all_interval={"calibration_compatible":False}
    for n in TEST:
        all_interval[str(n)+"/coverage"]=False
        all_interval[str(n)+"/width"]=False
    checked(all_interval==outcome["score"]["interval_gates"],"secondary gates")
    bounds=independent_bounds(all_scans,bank)
    return {"bounds":bounds,"raw_reduced_rows":sum(len(d["q"]) for d in all_scans.values()),
            "raw_vectors":len(discrepancies),"maximum_raw_ordinate_or_grid_error":max(discrepancies),
            "held_scalar_residuals":len(TEST)*56*len(ARMS),"scan_arm_scores":len(TEST)*len(ARMS),
            "contrast_scores":by_group,"primary_gates":gates,"interval_gates":all_interval,
            "invalid_calibration_bands":incompatible,"worst_raw_acquisition_components":witnesses}

DENSITY={3493:6.36,3494:6.36,3495:4.0,3496:4.0,3497:4.0,3498:2.07,3499:2.07,3500:-.56,3501:-.56}
DEPTHS=tuple((z,math.erfc(z/math.sqrt(2))/2) for z in range(2,9))

def radius(a,b):
    qa,sa,ra=a
    qb,sb,rb=b
    variance=sa*sa+sb*sb
    # H^2 = 2 - 2*overlap. expm1 evaluates nearly identical kernels stably.
    log_overlap=0.5*math.log1p(-((sa-sb)**2)/variance)-(qa-qb)**2/(4*variance)
    hellinger=math.sqrt(max(0.,-2*math.expm1(log_overlap)))
    upper=1.
    for z,tail in DEPTHS:
        left=qa-z*sa
        a2=(left/2)**2-4*math.pi*(ra-2.07)*1e-6
        b2=(left/2)**2-4*math.pi*(rb-2.07)*1e-6
        if min(left,a2,b2)<=0:
            continue
        ay=math.sqrt(a2)
        by=math.sqrt(b2)
        delta=abs(ay-by)/(ay+by)
        upper=min(upper,hellinger+math.sqrt(tail+(1-tail)*delta*delta))
    return min(upper+2e-12,1.)

def independent_bounds(scans,bank):
    widths=math.sqrt(8*math.log(2))
    points={(n,j):(float(q),float(w)/widths,DENSITY[n]) for n,scan in scans.items()
            for j,(q,w) in enumerate(zip(scan["q"],scan["fwhm"]))}
    boxes={(n,j):(math.sqrt(max(0,r-3*d)),math.sqrt(min(1,max(0,r+3*d))))
           for n in TRAIN for j,(r,d) in enumerate(zip(scans[n]["R"],scans[n]["dR"]))}
    violations={}
    limits=bank["envelopes"]["limits"]
    maximum=0.
    for key in sorted(boxes):
        for other in sorted(boxes):
            if other<=key:
                continue
            rad=radius(points[key],points[other])
            gap=max(boxes[key][0]-boxes[other][1],boxes[other][0]-boxes[key][1])
            if gap>rad:
                violations[key+other]=(gap,rad)
    archived={tuple(row[:4]):row[4:] for row in bank["envelopes"]["incompatible_training_pairs"]}
    checked(violations.keys()==archived.keys(),"incompatible pair census")
    for key,(gap,rad) in violations.items():
        maximum=max(maximum,abs(gap-archived[key][0]),abs(rad-archived[key][1]))
    local_valid={}
    for n in TEST:
        count=0
        for j,expected in enumerate(limits[str(n)]):
            lower=0.
            upper=1.
            for key,(low,high) in boxes.items():
                rad=radius(points[key],points[n,j])
                lower=max(lower,max(0,low-rad)**2)
                upper=min(upper,min(1,high+rad)**2)
            maximum=max(maximum,abs(lower-expected[0]),abs(upper-expected[1]))
            count+=lower<=upper
        local_valid[n]=count
    checked(maximum<5e-8,"stable exponential recomputation of paired bounds")
    return {"nonindependent_pair_violations":len(violations),"held_row_endpoints":560,
            "locally_nonempty_rows":local_valid,"maximum_stable_formula_difference":maximum}

if __name__=="__main__":
    import sys
    here=pathlib.Path(__file__).resolve().parent
    bank=unpack(here/"forecast.json.zlib","3424f6ab23acd97a38ec43a9f3ba6aec8d708f5d2a9236566d86b2468fdc14d7")
    outcome=unpack(here/"outcome.json.zlib","f4e3b56b82ec7e84a2c259f622bb8fe78a48c8b36263588a865b3edd73754a24")
    receipt=evaluate(pathlib.Path(sys.argv[1]),bank,outcome)
    print("INDEPENDENT",json.dumps(receipt,sort_keys=True,separators=(",",":")))
