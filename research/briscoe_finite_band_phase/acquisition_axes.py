"""Read only the recorded detuning field for sixteen native acquisitions."""
import hashlib,io,json,pathlib,urllib.request,zipfile,struct
import numpy as np
req=urllib.request.Request("https://researchdata.durham.ac.uk/downloads/r2x920fw90c",headers={"User-Agent":"public experimental frequency-axis reader"})
with urllib.request.urlopen(req,timeout=150) as x:b=x.read()
assert hashlib.md5(b).hexdigest()=="6873c7048302b16f2e898682cb2e2709"
out={}
with zipfile.ZipFile(io.BytesIO(b)) as z:
    for n in z.namelist():
        if "/Data without fit/Faraday/" not in n or not n.endswith(".csv"):continue
        # The ordinate stays in the raw line. Never convert or retain it here.
        with z.open(n) as f:a=np.array([float(l.partition(b",")[0]) for l in f if l.strip()],dtype="<f8")
        d=np.diff(a);o=np.sort(a);sd=np.diff(o)
        assert np.isfinite(a).all()
        out[n.split("/Faraday/")[-1]]={"N":len(a),"start":a[0],"end":a[-1],"min":a.min(),"max":a.max(),"descending":int((d<0).sum()),"ascending":int((d>0).sum()),"repeated":int((sd==0).sum()),"sorted_max_gap_GHz":sd.max(),"sorted_median_step_GHz":np.median(sd),"vector_sha":hashlib.sha256(a.tobytes()).hexdigest()}
print(json.dumps(out,sort_keys=True))
