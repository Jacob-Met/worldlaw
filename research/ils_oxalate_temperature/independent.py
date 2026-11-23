"""Independent physical-byte receiver for the pinned R XDR matrix and frozen forecasts."""
import collections
import gzip
import hashlib
import json
import lzma
import math
import pathlib
import statistics
import struct
import sys
import urllib.request

PACKED="cfded84c4386475437347c4a63ca4ffe46cf66544b2ba3f9cbc6731e48767ecc"
FORECAST="a3798e58660d0d6589b51cf4a32d931fc37e28a60e9b874590578bf9e6282543"
SCORE="c185be5aae1d041c25579d2c9e8121b4d6ff6fcad2770d2beb16037e02aa5019"
COUNTS=("reference","translation","free_affine","constant","gain","ridge")


def checked(bytes_,expected):
    assert hashlib.sha256(bytes_).hexdigest()==expected
    return bytes_


def matrix(raw):
    # A named TG REALSXP with one integer dim attribute, using R XDR v2.
    data=lzma.decompress(checked(raw,PACKED))
    assert data[:7]==b"RDX2\nX\n" and len(data)==840088
    pos=7
    def word():
        nonlocal pos
        val=struct.unpack_from(">i",data,pos)[0];pos+=4
        return val
    def symbol(name):
        nonlocal pos
        assert word()==1 and (word()&255)==9 and word()==len(name)
        assert data[pos:pos+len(name)]==name;pos+=len(name)
    assert word()==2
    writer,reader=word(),word()
    assert word()==1026
    symbol(b"TG")
    assert word()==526 and word()==105000
    offset=pos;pos+=105000*8
    assert word()==1026
    symbol(b"dim")
    assert [word() for _ in range(6)]==[13,2,105,1000,254,254] and pos==len(data)
    return memoryview(data)[offset:offset+105000*8],dict(writer=writer,reader=reader,data_offset=offset,shape=[105,1000])


def partition(g,r):
    if g in (2,3,4,5):return "reference"
    return "early_calibration" if r<=5 else "held"


def signatures(matrix_,indices):
    groups=collections.defaultdict(list)
    for g in range(1,8):
        for r in range(1,16):
            row=(g-1)*15+r-1
            bits=b"".join(matrix_[8*(105*k+row):8*(105*k+row+1)] for k in indices)
            groups[bits].append([g,r])
    classes=[]
    for bits,labels in groups.items():
        classes.append(dict(sha256=hashlib.sha256(bits).hexdigest(),members=labels,
                            partitions=sorted(set(partition(*a) for a in labels))))
    return dict(count_unique=len(groups),grid_count=len(indices),classes=classes,
                cross_partition=[c["members"] for c in classes if len(c["partitions"])>1],
                by_group={str(g):sum(any(a[0]==g for a in c["members"]) for c in classes) for g in range(1,8)})


def mean(x):
    return math.fsum(x)/len(x)


def physical_recount(raw,forecast_bytes):
    matrix_,meta=matrix(raw)
    f=json.loads(checked(forecast_bytes,FORECAST))
    t=[40+k*(810/999) for k in range(1000)]
    ix={"whole":[k for k,x in enumerate(t) if x>=320],"second":[k for k,x in enumerate(t) if 320<=x<560],"third":[k for k,x in enumerate(t) if x>=560]}
    sig={name:signatures(matrix_,ids) for name,ids in dict(full=list(range(1000)),early=[k for k,x in enumerate(t) if x<=280],**ix).items()}
    assert max(abs(t[k]-f["T"][i]) for i,k in enumerate(ix["whole"]))<2e-12
    records={};upper={};point_comparisons=0;storage_indices={}
    for g in [1,6,7]:
        pack=f["groups"][str(g)];curves=pack["mass"];names=sorted(curves)
        assert len(names)==14 and all(len(curves[r])==len(f["T"]) for r in names)
        per={};rm={};ma={};worst=(-1,None);hs=[]
        for w,indices in ix.items():
            per[w]={r:[] for r in names};ma[w]={r:[] for r in names}
            for s in range(6,16):
                physical_row=(g-1)*15+s-1
                for name in names:
                    residual=[]
                    for k in indices:
                        j=k-ix["whole"][0]
                        u=struct.unpack_from(">d",matrix_,8*(105*k+physical_row))[0]
                        a=u-curves[name][j];residual.append(a)
                        if name=="zinc" and w=="whole" and abs(a)>worst[0]:
                            worst=(abs(a),[s,k,t[k],u,curves[name][j],a])
                    if w=="whole":point_comparisons+=len(residual)
                    per[w][name].append(math.sqrt(mean([a*a for a in residual])))
                    ma[w][name].append(mean([abs(a) for a in residual]))
                if w=="whole":
                    bits=b"".join(matrix_[8*(105*k+physical_row):8*(105*k+physical_row+1)] for k in indices)
                    hs.append(hashlib.sha256(bits).hexdigest())
            rm[w]={r:mean(vals) for r,vals in per[w].items()};ma[w]={r:mean(vals) for r,vals in ma[w].items()}
        gates={name:rm["whole"]["zinc"]<rm["whole"][name] for name in COUNTS}
        for w in ("second","third"):gates[w+"_translation"]=rm[w]["zinc"]<rm[w]["translation"]
        wins=sum(x<y for x,y in zip(per["whole"]["zinc"],per["whole"]["ridge"]))
        # Secondary duplicate equivalence-class weights; the primary membership never changes.
        first=[i for i,h in enumerate(hs) if h not in hs[:i]]
        records[str(g)]=dict(rmse=rm,mae=ma,per=per,worst=worst[1],gates=gates,ridge_wins=wins,
             passed=all(gates.values()) and wins>=6,held_curve_bigendian_float64_sha256=hs,
             secondary_unique_late={r:mean([v[i] for i in first]) for r,v in per["whole"].items()},unique_held_late=len(first))
    return dict(r_xdr=meta,groups=records,signatures=sig,physical_coordinate_comparisons=point_comparisons,
                physically_scored_cells=30*len(ix["whole"]),all_labels=105,primary=records["7"]["passed"])


def compare(a,b):
    result=[]
    for group in ["1","6","7"]:
        p,q=a["groups"][group],b["groups"][group]
        for section in ("rmse","mae","per"):
            for w,roles in p[section].items():
                for r,v in roles.items():
                    if isinstance(v,list):result.extend(abs(x-y) for x,y in zip(v,q[section][w][r]))
                    else:result.append(abs(v-q[section][w][r]))
        assert p["gates"]==q["gates"] and p["ridge_wins"]==q["ridge_wins"] and p["passed"]==q["passed"]
        assert [q["worst"]["specimen"],q["worst"]["grid_index"]]==p["worst"][:2]
        assert abs(q["worst"]["truth"]-p["worst"][3])<1e-12
        for h,row in zip(p["held_curve_bigendian_float64_sha256"],q["truth"]):
            assert hashlib.sha256(b"".join(struct.pack(">d",y) for y in row)).hexdigest()==h
    assert len(result)==1512 and max(result)<3e-12 and a["primary"]==b["primary"]
    return dict(metric_checks=len(result),max_delta=max(result),all30_original_target_vectors_exact=True)


if __name__=="__main__":
    root=pathlib.Path(sys.argv[1])
    if len(sys.argv)>2:raw=pathlib.Path(sys.argv[2]).read_bytes()
    else:raw=urllib.request.urlopen("https://raw.githubusercontent.com/cran/ILS/a46be10f6073c94c103888056bcf2caea0f78b37/data/TG.RData",timeout=40).read()
    a=physical_recount(raw,(root/"forecasts.json").read_bytes())
    b=json.loads(checked((root/"score.json").read_bytes(),SCORE))
    a["independent"]=compare(a,b)
    print(json.dumps(a,sort_keys=True,allow_nan=False,separators=(",",":")))
