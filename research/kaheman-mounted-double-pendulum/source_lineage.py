"""Inventory MAT v5 containers and compare opaque eight-byte angle tokens.

Only container tags, names, dimensions, word equality and byte offsets are
interpreted. No trajectory, angle or timestamp sample is decoded numerically.
"""
import hashlib, io, json, math, pathlib, struct, subprocess, sys, tempfile, urllib.parse, urllib.request, zipfile, zlib
import numpy as np

class RangeFile(io.RawIOBase):
    def __init__(self,url,size):
        self.url,self.size,self.pos=url,size,0
    def seekable(self):return True
    def readable(self):return True
    def tell(self):return self.pos
    def seek(self,pos,whence=0):
        value=pos if whence==0 else self.pos+pos if whence==1 else self.size+pos
        if value<0:raise ValueError("negative range")
        self.pos=value;return value
    def read(self,n=-1):
        length=self.size-self.pos if n<0 else min(n,self.size-self.pos)
        if length<=0:return b""
        if length>8*1024*1024:
            return b"".join(self.read(min(8*1024*1024, length-offset)) for offset in range(0,length,8*1024*1024))
        start=self.pos;end=start+length-1
        req=urllib.request.Request(self.url,headers={"Range":f"bytes={start}-{end}","Accept-Encoding":"identity","User-Agent":"public-research-metadata/1.0"})
        with urllib.request.urlopen(req,timeout=70) as rr:
            assert rr.status==206 and rr.headers.get("Content-Range","").startswith(f"bytes {start}-{end}/"),(rr.status,rr.headers.get("Content-Range"))
            byte=rr.read(length+1)
        assert len(byte)==length;self.pos+=len(byte);return byte


def elements(raw):
    pos=0
    while pos+8<=len(raw):
        word,length=struct.unpack_from("<II",raw,pos)
        if word>>16:
            size=word>>16; typ=word&65535
            if size>4:raise ValueError("invalid compact MAT5 field")
            yield typ,raw[pos+4:pos+4+size];pos+=8
        else:
            typ=word
            if pos+8+length>len(raw):raise ValueError("out-of-range MAT5 field")
            yield typ,raw[pos+8:pos+8+length]
            pos+=8+(length if typ==15 else (length+7)//8*8)


def parse(raw,path,arrays):
    vals=list(elements(raw))
    if len(vals)<3:return
    flags,dimensions,name=vals[:3]
    cls=struct.unpack_from("<I",flags[1],0)[0]&255
    dims=tuple(x[0] for x in struct.iter_unpack("<i",dimensions[1]))
    n=name[1].decode("utf-8","replace").strip(chr(0));path=path or n
    if cls==1:
        for i,(typ,data) in enumerate(vals[3:]):
            if typ==14:parse(data,f"{path}{{{i}}}",arrays)
    elif cls==2:
        width=struct.unpack_from("<i",vals[3][1],0)[0];names=vals[4][1]
        fields=[names[i:i+width].split(bytes(1))[0].decode("utf8","replace") for i in range(0,len(names),width)]
        if not fields:return
        for i,(typ,data) in enumerate(vals[5:]):
            if typ==14:parse(data,path+"."+fields[i%len(fields)],arrays)
    elif cls==6 and len(vals)>=4 and vals[3][0]==9:
        payload=vals[3][1]
        if len(payload)!=math.prod(dims)*8:raise ValueError("opaque double payload length mismatch")
        arrays[path]=(dims,payload)


def mat_members(raw):
    assert raw[126:128]==b"IM"
    arrays={}
    for typ,data in elements(raw[128:]):
        if typ==15:
            for t,r in elements(zlib.decompress(data)):
                if t==14:parse(r,"",arrays)
        elif typ==14:parse(data,"",arrays)
    return arrays


def col_bytes(payload,dims,row):
    assert len(dims)==2 and 0<=row<dims[0]
    return np.frombuffer(payload,dtype="V8").reshape(dims,order="F")[row,:].tobytes()


def lookup(hay,needle):
    if len(needle)<128*8:return []
    # Exclude flat padded sequences, which have no identifying information.
    if len(set(needle[k:k+8] for k in range(0,len(needle),8)))<=16:return []
    hits=[];start=0
    while len(hits)<32:
        i=hay.find(needle,start)
        if i<0:break
        start=i+1
        if i%8==0:hits.append(i//8)
    return hits


def main():
    root=pathlib.Path(tempfile.mkdtemp(prefix="p1-kaheman-opaque-"))
    with urllib.request.urlopen("https://zenodo.org/api/records/6633719",timeout=45) as r:record=json.load(r)
    f=next(t for t in record["files"] if t["key"]=="MultiArm-Pendulum.zip");assert f["checksum"]=="md5:b7ef285267d3ebb7f31370ad1df55b99"
    receipt={};double={}
    with zipfile.ZipFile(RangeFile(f["links"]["self"],int(f["size"]))) as arc:
        for fam,narms in (("Single",1),("Double",2),("Triple",3)):
            pref="ParameterEstimation/"+fam+"Pendulum/"
            prepared=pref+fam+"PendulumDataForParameterEstimation.mat"
            arr=mat_members(arc.read(prepared))
            names=sorted(k for k in arr if k.startswith("Y_id{") or k.startswith("Y_vad{"))
            assert names,(prepared,list(arr)[:45])
            course={"prepared":prepared,"segments":len(names),"files":[]}
            for info in arc.infolist():
                if not info.filename.startswith("Datas/"+fam+"Pendulum/") or "FreeSwing" not in info.filename or not info.filename.endswith(".mat"):continue
                raw=arc.read(info);d=mat_members(raw)
                angles={}
                for i in range(1,narms+1):
                    options=[k for k,(dims,p) in d.items() if (k==f"Theta{i}" or k.lower() in (f"theta{i}.signals.values",f"theta{i}.data",f"theta{i}.values.data")) and len(p)>128*8]
                    assert len(options)==1,(info.filename,i,sorted(d))
                    angles[i]=d[options[0]][1]
                if fam=="Double":
                    ticks=np.frombuffer(d["Time"][1],dtype="<f8")
                    assert np.all(np.isfinite(ticks)) and np.all(np.diff(ticks)>0)
                    assert all(d[k][0]==d["Time"][0] for k in ("Theta1","Theta2","dTheta1","dTheta2"))
                    channels=np.empty((len(ticks),2),dtype="V8")
                    for i in range(2):channels[:,i]=np.frombuffer(angles[i+1],dtype="V8")
                    double[info.filename]=(channels.tobytes(),{"samples":len(ticks),"t_first":float(ticks[0]),"t_last":float(ticks[-1]),"dt_file":struct.unpack("<d",d["dt"][1])[0],"dt_min":float(np.diff(ticks).min()),"dt_max":float(np.diff(ticks).max()),"MAT_writer_header_not_acquisition":raw[:116].decode("ascii","replace").strip(),"zip_timestamp_not_acquisition":info.date_time})
                matches=[]
                for name in names:
                    dims,p=arr[name];assert dims[0]==2*narms,(name,dims)
                    # Use the full segment for qualification; partial fingerprints
                    # remain separately identified if values were resampled.
                    full=None;small=None
                    for i,hay in angles.items():
                        needle=col_bytes(p,dims,i-1)
                        hit=set(lookup(hay,needle))
                        probe=needle[:min(len(needle),512*8)]
                        ph=set(lookup(hay,probe))
                        full=hit if full is None else full&hit
                        small=ph if small is None else small&ph
                    matches.append({"segment":name,"length":dims[1],"common_full_word_offsets":sorted(full),"common_first512_offsets":sorted(small)})
                row={"path":info.filename,"opaque_file_sha":hashlib.sha256(raw).hexdigest(),"schema":{k:list(v[0]) for k,v in d.items()},"matches":matches}
                course["files"].append(row)
                print("MATCH",fam,info.filename,sum(bool(m["common_full_word_offsets"]) for m in matches),sum(bool(m["common_first512_offsets"]) for m in matches),len(matches),[(m["segment"],m["common_full_word_offsets"]) for m in matches if m["common_full_word_offsets"]][:3],flush=True)
            receipt[fam]=course
            (root/(fam+".json")).write_text(json.dumps(course,sort_keys=True))
    pair_result=[]
    for ka,(a,aclock) in sorted(double.items()):
        print("CLOCK",ka,aclock,flush=True)
        for kb,(b,_) in sorted(double.items()):
            if ka==kb:continue
            scanned=informative=hits=0
            for begin in range(0,len(a)-512*16+1,512*16):
                block=a[begin:begin+512*16];scanned+=1
                if len(set(block[i:i+16] for i in range(0,len(block),16)))<17:continue
                informative+=1
                cursor=0
                while True:
                    j=b.find(block,cursor)
                    if j<0:break
                    if j%16==0:hits+=1;break
                    cursor=j+1
            pair_result.append(dict(first=ka,second=kb,scanned=scanned,informative=informative,with_match=hits))
            print("PAIR",ka.split("/")[-1],kb.split("/")[-1],scanned,informative,hits,flush=True)
    receipt["double_clocks"]={k:v[1] for k,v in double.items()};receipt["double_pairs"]=pair_result
    path=root/"opaque-identity-receipt.json";path.write_text(json.dumps(receipt,sort_keys=True));print("COMPLETE",hashlib.sha256(path.read_bytes()).hexdigest(),path,flush=True)


if __name__=="__main__":main()
