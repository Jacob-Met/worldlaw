"""Measure native stellar-ramp read codes and last-read saturation flags on a fixed cohort."""
import hashlib
import json
import math
import pathlib
import urllib.request
import numpy as np

from stimulus_support import VISITS, DTYPES, SHAPE, OUTPUT, fits_value, image_data

# Source-locked row-major first maximum-count site from each threshold in the first audit.
SITES = {"01": [(1,845),(53,893)], "02": [(0,841)], "03": [(0,810),(0,838)]}
IMA_PREFIX = 12 * 1024 * 1024


def read_file(member, kind, byte_limit, partial=False):
    url = f"https://mast.stsci.edu/api/v0.1/Download/file?uri=mast:HST/product/{member}_{kind}.fits"
    h = {"User-Agent": "HST WFC3 archival stellar ramp support study"}
    if partial:
        h["Range"] = f"bytes=0-{byte_limit-1}"
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=180) as response:
        if partial:
            assert response.status == 206 and response.headers["Content-Range"].split("/")[0] == f"bytes 0-{byte_limit-1}"
        else:
            assert response.status == 200
        payload = response.read(byte_limit + 1)
    assert len(payload) <= byte_limit and payload.startswith(b"SIMPLE  =")
    return payload


def imsets(data, partial=False):
    offset = 0
    while offset + 2880 <= len(data):
        header = {}
        ended = False
        while not ended:
            if offset + 2880 > len(data):
                if partial:
                    return
                raise ValueError("Incomplete HDU header")
            block = data[offset:offset+2880]
            offset += 2880
            for i in range(0,2880,80):
                card = block[i:i+80].decode("ascii")
                if card[:8].strip() == "END":
                    ended = True
                    break
                if card[8:10] == "= ":
                    header[card[:8].strip()] = fits_value(card[10:])
        shape = tuple(int(header[f"NAXIS{i}"]) for i in range(int(header["NAXIS"]),0,-1))
        bitpix = int(header["BITPIX"])
        size = (math.prod(shape) if shape else 0) * abs(bitpix)//8
        assert int(header.get("PCOUNT",0)) == 0 and int(header.get("GCOUNT",1)) == 1
        if offset + size > len(data):
            if partial:
                return
            raise ValueError("Short image")
        yield header, np.ndarray(shape,buffer=data,dtype=DTYPES[bitpix],offset=offset) if shape else None
        offset += (size+2879)//2880*2880


def check_primary(h, member):
    assert h["ROOTNAME"].lower() == member and h["TARGNAME"] == "WESTERLUND-1"
    assert h["PROPOSID"] == "14016" and h["DETECTOR"] == "IR" and h["SUBARRAY"] == "F"
    assert h["FILTER"] == "F140W" and int(h["NAXIS"]) == 0


def read_raw(member,sites):
    b = read_file(member,"raw",40_000_000)
    groups = imsets(b)
    main,_ = next(groups)
    check_primary(main,member)
    readings = []
    for h,arr in groups:
        if h.get("EXTNAME") != "SCI":
            continue
        assert h["BUNIT"] == "COUNTS" and arr.shape == (1024,1024) and int(h["BITPIX"]) == 16
        scale = float(h.get("BSCALE",1))
        zero = float(h.get("BZERO",0))
        adc = [float(arr[y+5,x+5]) * scale + zero for y,x in sites]
        readings.append({"extver":int(h["EXTVER"]),"t_s":float(h["SAMPTIME"]),"raw_counts":adc})
    readings.sort(key=lambda r:r["t_s"])
    assert len(readings) == int(main["NSAMP"]) and readings[-1]["extver"] == 1
    assert all(a["t_s"] < c["t_s"] for a,c in zip(readings,readings[1:]))
    return readings, {"raw_sha256":hashlib.sha256(b).hexdigest(),"raw_bytes":len(b)}


def last_saturation(member,sites):
    b = read_file(member,"ima",IMA_PREFIX,partial=True)
    groups = imsets(b,partial=True)
    main,_ = next(groups)
    check_primary(main,member)
    assert main["NLINCORR"] == "COMPLETE"
    t = None
    for h,arr in groups:
        if int(h.get("EXTVER",0)) != 1:
            continue
        if h["EXTNAME"] == "SCI":
            t = float(h["SAMPTIME"])
        if h["EXTNAME"] == "DQ":
            assert t is not None and abs(t-float(main["EXPTIME"])) < .005
            if arr is None:
                assert "PIXVALUE" in h and int(h["NPIX1"]) == 1024 and int(h["NPIX2"]) == 1024
                dq = np.full((1024,1024),int(h["PIXVALUE"]),dtype=np.int64)
            else:
                assert arr.shape == (1024,1024) and float(h.get("BSCALE",1)) == 1
                dq = arr.astype(np.int64) + int(float(h.get("BZERO",0)))
            mask = (dq[5:-5,5:-5] & 256) != 0
            return mask,{"ima_prefix_sha256":hashlib.sha256(b).hexdigest(),"ima_prefix_bytes":len(b),"ima_dq_extver":1,"ima_last_read_s":t,"ima_last_dq_at_sites":[int(dq[y+5,x+5]) for y,x in sites],"last_saturated_cells":int(mask.sum())}
    raise ValueError("Last-read DQ not fully covered by the registered range")


def measure(visit):
    roster=VISITS[visit]
    old=json.loads((OUTPUT / f"stellar-support-{visit}.json").read_text())
    old_sha={m["rootname"]:m["sha256"] for m in old["members"]}
    good_in_all=np.ones(SHAPE,dtype=bool)
    counts=np.zeros(SHAPE,dtype=np.uint8)
    high=np.zeros(SHAPE,dtype=np.uint8)
    rows=[]
    for m in roster:
        sites=SITES[visit]
        reads,meta=read_raw(m,sites)
        saturation,dq=last_saturation(m,sites)
        assert abs(reads[-1]["t_s"]-dq["ima_last_read_s"]) <.005
        flt=read_file(m,"flt",19_000_000)
        assert hashlib.sha256(flt).hexdigest()==old_sha[m]
        headers,a=image_data(flt)
        good_in_all &= np.isfinite(a["SCI"]) & (a["DQ"]==0)
        high += (a["SCI"] * float(headers["PRIMARY"]["EXPTIME"]) >= 70000)
        counts += saturation
        rows.append({"rootname":m,**meta,**dq,"raw_reads":reads,"flt_sha256":old_sha[m],"flt_bytes":len(flt)})
    cross=np.zeros((len(roster)+1,len(roster)+1),dtype=np.int64)
    np.add.at(cross,(high[good_in_all],counts[good_in_all]),1)
    assert int(good_in_all.sum())==old["coordinates_good_in_all_inputs"]
    res={"visit":visit,"sites_zero_based_flt":SITES[visit],"inputs":rows,"all_good_full_time_saturation_hist":np.bincount(counts[good_in_all],minlength=len(roster)+1).tolist(),"all_coordinates_full_time_saturation_hist":np.bincount(counts.ravel(),minlength=len(roster)+1).tolist(),"joint_flt70k_count_by_ima_final256_count_good":cross.tolist()}
    b=json.dumps(res,sort_keys=True).encode()
    path=OUTPUT / f"source-native-read-{visit}.json";path.write_bytes(b)
    print("VISIT",visit,len(b),hashlib.sha256(b).hexdigest(),flush=True)
    return res


if __name__=="__main__":
    print(json.dumps({v:measure(v) for v in VISITS},sort_keys=True))
