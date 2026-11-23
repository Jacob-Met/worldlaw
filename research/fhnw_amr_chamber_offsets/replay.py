"""Independently reconstruct the field projection and all stored forecast errors."""
import ast,base64,hashlib,io,json,math,struct,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent
def read_array(raw):
    assert raw[:8]==b"\x93NUMPY\x01\x00"
    n=struct.unpack_from("<H",raw,8)[0]
    h=ast.literal_eval(raw[10:10+n].decode())
    assert h["descr"]=="<f8" and not h["fortran_order"]
    return h["shape"],struct.unpack_from("<"+"d"*math.prod(h["shape"]),raw,10+n)
def product(a,b):return math.fsum(x*y for x,y in zip(a,b))
def solve3(A,x):
    m=[list(row)+[y] for row,y in zip(A,x)]
    for i in range(3):
        k=max(range(i,3),key=lambda j:abs(m[j][i]));m[i],m[k]=m[k],m[i]
        d=m[i][i];assert abs(d)>1e-10
        m[i]=[x/d for x in m[i]]
        for j in range(3):
            if j!=i:
                a=m[j][i];m[j]=[y-a*z for y,z in zip(m[j],m[i])]
    return [r[-1] for r in m]
def rms(x):return math.sqrt(math.fsum(a*a for a in x)/len(x))
def main():
    score=json.loads((root/"measured_chamber.json").read_text())
    stamp=json.loads((root/"forecast_lock.json").read_text())
    r=base64.b64decode((root/"forecast_bytes.txt").read_text())
    assert len(r)==stamp["size"] and hashlib.sha256(r).hexdigest()==stamp["sha"]
    with zipfile.ZipFile(io.BytesIO(r)) as z:a={k[:-4]:read_array(z.read(k)) for k in z.namelist()}
    ids=[int(x) for x in a["sensor_id"][1]];assert ids==score["ids"] and 24 not in ids
    tg=[x for row in score["target"] for x in row];prev=a["prior_chamber"][1]
    slopes=a["response7"][1];P=a["predictions"][1];a0=a["pose_intercept7"][1]
    c=[math.fsum(a0[pose*189+i] for pose in range(3))/3 for i in range(189)]
    cols=[slopes[j::3] for j in range(3)]
    gram=[[product(col,x) for x in cols] for col in cols]
    def project(v):
        theta=solve3(gram,[product(col,v) for col in cols])
        return [sum(a*b for a,b in zip(row,theta)) for row in zip(*cols)]
    shift=project([v-w for v,w in zip(c,prev)])
    fit=max(abs((v-d)-y) for v,d,y in zip(c,shift,P[:189]))
    assert fit<1e-10
    worst=[];eps=[];ma=[]
    for j in range(12):
        e=[a-b for a,b in zip(P[j*189:(j+1)*189],tg)];d=score["roles"][j]
        p=project(e);x=[e[a::3] for a in range(3)]
        unit=[math.sqrt(math.fsum(a*a for a in e[i:i+3])) for i in range(0,189,3)]
        k=max(range(189),key=lambda i:abs(e[i]))
        assert [ids[k//3],k%3]==d["worst_component"][:2] and ids[unit.index(max(unit))]==d["worst_chip"]
        ma.append([rms(col) for col in x]);worst.append(rms(e))
        estimates=[rms(e),rms(p),rms([a-b for a,b in zip(e,p)]),sum(unit)/63,max(unit),e[k]]
        comp=[d["rmse"],d["gauge_rmse"],d["observable_rmse"],d["mean_vector_error"],d["worst_chip_euclidean"],d["worst_component"][2]]
        eps.extend(abs(a-b) for a,b in zip(estimates+ma[-1],comp+d["axis_rmse"]))
    gate=all(worst[0]<x for i,x in enumerate(worst) if i not in [0,4]) and all(ma[0][k]<min(ma[1][k],ma[2][k]) for k in range(3))
    assert gate==score["gate"] and max(eps)<1e-10
    print(json.dumps(dict(component_residuals=12*189,source_chips=63,forecast_delta=fit,metric_delta=max(eps),overall=worst,gate=gate),sort_keys=True))
if __name__=="__main__":main()
