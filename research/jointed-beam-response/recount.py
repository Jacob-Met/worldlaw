"""Independent scalar source receiver for the eight frozen response-control curves."""
import hashlib
import json
import math
import struct
import zlib


def parts(buf, start=0):
    """Traverse ordinary padded MATLAB subelements. Skip payloads until selected."""
    while start<len(buf):
        typ,n=struct.unpack_from("<II",buf,start)
        small=typ//65536
        if small:
            yield typ%65536,buf[start+4:start+4+small]
            start+=8
        else:
            yield typ,buf[start+8:start+8+n]
            start+=8+8*((n+7)//8)
    assert start==len(buf)


def unpack_struct(matrix):
    itr=iter(parts(matrix))
    flags=next(itr)[1]; assert struct.unpack_from("<I",flags)[0]%256==2
    dims=next(itr)[1];count=math.prod(struct.unpack("<"+"i"*(len(dims)//4),dims))
    next(itr)
    k=struct.unpack_from("<i",next(itr)[1])[0]
    raw=next(itr)[1]
    fields=[raw[i:i+k].tobytes().split(bytes(1))[0].decode() for i in range(0,len(raw),k)]
    rows=[]
    for _ in range(count):
        row={}
        for f in fields:
            typ,child=next(itr)
            assert typ==14
            row[f]=child
        rows.append(row)
    assert next(itr,None) is None
    return rows


def samples(matrix):
    fields=list(parts(matrix))
    assert len(fields)==4 and fields[3][0]==9
    buf=fields[3][1]
    return struct.unpack("<"+"d"*(len(buf)//8),buf)


def reference_curves(source):
    assert hashlib.sha256(source).hexdigest()=="e4bfe248b921edbd23153c24a37c3a9e1556fb1bf59fe6d9e63ae8e2177f1100"
    t,n=struct.unpack_from("<II",source,128)
    if t==15:
        plain=zlib.decompress(source[136:136+n]); typ,sz=struct.unpack_from("<II",plain);assert typ==14
        data=memoryview(plain)[8:8+sz]
    else:
        assert t==14
        data=memoryview(source)[136:136+n]
    root,=unpack_struct(data)
    assert set(root)=={"ForceControl","ResponseControl"}
    curves=[]
    for row in unpack_struct(root["ResponseControl"]):
        fields=list(parts(row["units"]))
        kind,content=fields[-1]
        enc={4:"utf-16le",3:"utf-16le",16:"utf8",17:"utf-16le",18:"utf-32le",2:"latin1",1:"latin1"}
        units=bytes(content).decode(enc[kind])
        if units!="Hz, N, m/s^2, rad":
            raise ValueError("Unexpected embedded response-control units: "+units)
        curves.append({k:samples(row[k]) for k in ("phase","force")})
    return curves


def run(source, forecast, outcome):
    refs=reference_curves(source)
    assert len(refs)==len(forecast["curves"])==len(outcome["curves"])==8
    by_arm={};largest=0.;obs_count=pred_count=0;min_force_rms=math.inf
    def compare(x,y):
        nonlocal largest
        largest=max(largest,abs(x-y))
        assert abs(x-y)<1e-10
    for i,(truth,c,evidence) in enumerate(zip(refs,forecast["curves"],outcome["curves"])):
        n=len(truth["force"]);assert n==len(truth["phase"])==len(c["frequency_hz"])==41
        obs_count+=n
        rms=math.sqrt(math.fsum(x*x for x in truth["force"])/n)
        min_force_rms=min(min_force_rms,rms)
        compare(rms,evidence["observed_force_rms_N"])
        for arm, pred in c["models"].items():
            e=evidence["per_arm"][arm]
            phase=[];force=[]
            for x,y,a,b in zip(truth["phase"],truth["force"],pred["folded_phase_deg"],pred["normalized_force"]):
                m=x%180
                phase.append(a-min(m,180-m));force.append(b-y/rms)
                pred_count+=2
            mae=math.fsum(abs(q) for q in phase)/n
            rmse=math.sqrt(math.fsum(q*q for q in force)/n)
            compare(mae,e["phase_mae_deg"]);compare(rmse,e["force_shape_rmse"])
            for err,key,column in ((phase,"worst_phase","phase_miss_deg"),(force,"worst_shape","shape_miss")):
                j=max(range(n),key=lambda k:abs(err[k]));w=e[key]
                assert j==w["row"] and w["observed_phase_deg"]==truth["phase"][j] and w["observed_force_N"]==truth["force"][j]
                compare(err[j],w[column])
            by_arm.setdefault(arm,[]).append((mae,rmse))
    table={}
    for arm,m in by_arm.items():
        stats=[math.fsum(p for p,_ in m)/8, math.fsum(f for _,f in m)/8, max(f for _,f in m)]
        for k,v in zip(("macro_phase_mae_deg","macro_force_shape_rmse","worst_curve_shape_rmse"),stats):
            compare(v,outcome["metrics"][arm][k])
        table[arm]=stats
    s,p=table["spatial-energy"],table["author-PFF"]
    gates=[s[0]<p[0],s[1]<p[1],s[2]<=p[2]]
    assert gates==[outcome["gates"][k] for k in ("macro_phase_beats_PFF","macro_shape_beats_PFF","worst_curve_shape_not_worse")]
    assert all(gates)==outcome["primary_joint"]
    return dict(curves=8,points=obs_count,paired_prediction_components=pred_count,
                worst_rows_compared=2*8*5,max_metric_or_witness_difference=largest,
                minimum_observed_curve_rms_N=min_force_rms,gates=gates,
                per_arm_macro_phase_shape_worst=table,force_control_numeric_arrays_accessed=0)
