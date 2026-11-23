"""Independently read the 63 original ZIP members and recompute all eight roles."""
import array
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import zipfile
import zlib
from source_lattice import Remote

def matlab_column_values(blob):
    if blob[126:128]!=b"IM" or sys.byteorder!="little":raise ValueError("endianness")
    top,sz=struct.unpack_from("<II",blob,128)
    if top!=15 or sz+136!=len(blob):raise ValueError("outer MATLAB container")
    m=zlib.decompress(blob[136:])
    if struct.unpack_from("<II",m)!=(14,len(m)-8):raise ValueError("matrix size")
    pos=8
    def next_element():
        nonlocal pos
        tag,n=struct.unpack_from("<II",m,pos);pos+=8
        if tag>>16:return tag&65535,m[pos-4:pos-4+(tag>>16)]
        out=memoryview(m)[pos:pos+n];pos+=8*((n+7)//8)
        return tag,out
    flags=next_element();dims=next_element();name=next_element();data=next_element()
    assert struct.unpack("<II",flags[1])==(6,0) and struct.unpack("<ii",dims[1])==(125000,2)
    assert bytes(name[1])==b"data" and data[0]==9 and pos==len(m)
    samples=array.array("d");samples.frombytes(data[1])
    assert len(samples)==250000
    return samples[:125000],samples[125000:]

def independent_observation(blob):
    x,y=matlab_column_values(blob)
    def moments(a,b):
        chans=[]
        for v in (x[a:b],y[a:b]):
            mean=math.fsum(v)/len(v)
            variance=math.fsum(t*t for t in v)/len(v)-mean*mean
            chans.extend((mean,math.sqrt(variance),min(v),max(v)))
        return chans+[math.sqrt(chans[1]**2+chans[5]**2)]
    return [moments(0,125000)]+[moments(i*31250,(i+1)*31250) for i in range(4)]

def main():
    load=lambda n:json.loads(Path(n).read_text())
    roster=load("matched_commands.json"); raw=Remote(roster["archive"])
    source=load("source_measurements.json");target=load("target_measurements.json")
    predicted=load("locked_forecasts.json"); score=load("score.json")
    expected={(r["bias"],r["step"]):r for r in source+target}
    deltas=[];joint={};count=0
    with zipfile.ZipFile(raw) as archive:
        for group in roster["triads"]:
            for row in group:
                r=expected[row["bias"],row["step"]]
                blob=archive.read(row["name"])
                assert hashlib.sha256(blob).hexdigest()==r["sha256"]
                moments=independent_observation(blob)
                for a,b in zip(moments,[r["full"]]+r["quarters"]):
                    v=[k for c in b["channel_mean_rms_min_max"] for k in c]+[b["joint"]]
                    deltas.extend(abs(k-j) for k,j in zip(a,v))
                joint[row["bias"],row["step"]]=moments[0][-1]
                count+=1
    assert count==63 and len(deltas)==2835 and max(deltas)<1e-12
    low=[joint[100,4*s] for s in range(21)]; mid=[joint[200,2*s] for s in range(21)]
    tgt=[joint[400,s] for s in range(21)];n=len(tgt)
    dot=lambda x,y:math.fsum(a*b for a,b in zip(x,y))
    gain=dot(low,mid)/dot(low,low)
    sl,sm=math.fsum(low),math.fsum(mid)
    slope=(n*dot(low,mid)-sl*sm)/(n*dot(low,low)-sl*sl)
    intercept=(sm-slope*sl)/n
    fore=[[4*b,b,b*2,0,b*b/a,b*gain,max(0,3*b-2*a),max(0,intercept+slope*b)] for a,b in zip(low,mid)]
    dp=max(abs(i-j) for a,b in zip(fore,predicted) for i,j in zip(a,b))
    assert dp<1e-12
    err=[[v-truth for v in row] for row,truth in zip(fore,tgt)]
    de=max(abs(i-j) for a,b in zip(err,score["errors"]) for i,j in zip(a,b))
    assert de<1e-12
    mae=[];worsts=[]
    for k in range(8):
        e=[v[k] for v in err]
        mae.append(math.fsum(map(abs,e))/n)
        worst=max(range(n),key=lambda i:abs(e[i]));worsts.append(worst)
        src=score["roles"][k]
        assert worst==src["worst"] and abs(src["max"]-abs(e[worst]))<1e-12
        assert abs(src["mae"]-mae[-1])<1e-12 and abs(src["rmse"]-math.sqrt(dot(e,e)/n))<1e-12
    wins=sum(abs(e[0])<abs(e[5]) for e in err)
    gate=mae[0]<min(mae[1:]) and wins>=11
    assert wins==score["candidate_wins_pooled"] and gate==score["gate"]
    print(json.dumps(dict(waveforms=count,scalar_voltages=15750000,statistics=len(deltas),max_statistics_difference=max(deltas),
                          max_forecast_difference=dp,max_error_difference=de,mae=mae,worsts=worsts,wins=wins,gate=gate),sort_keys=True))
if __name__=="__main__":main()
