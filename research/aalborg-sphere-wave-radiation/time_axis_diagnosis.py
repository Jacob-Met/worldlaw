"""Inspect time-column provenance only from the eight lower-release measured records."""
import hashlib
import io
import json
from urllib.request import urlopen
import zipfile
import numpy as np

with urlopen("https://www.oceanenergysystems.org/documents/55575-datafile.zip/",timeout=40) as response:
    opaque=response.read(17549046)
assert hashlib.sha256(opaque).hexdigest()=="04c4d78d6987e4eec6c31d692d3c5cf5adea2580ffcfe50fbbd44e6589c7623f"
with zipfile.ZipFile(io.BytesIO(opaque)) as archive:
    for drop in ['01','03']:
        for rep in range(1,5):
            name=f'Datafile/Experimental results/{drop}D_Measured{rep}_Raw.txt'
            with archive.open(name) as fh:
                first=fh.readline().strip()
                t=np.loadtxt(fh,usecols=0)
            d=np.diff(t)
            bad=np.flatnonzero(d<=0)
            print(json.dumps({'file':name,'n':len(t),'times_at_ends_s':[t[:4].tolist(),t[-4:].tolist()],
                'minmax_s':[float(t.min()),float(t.max())],'clock_steps_s':np.quantile(d,[0,.01,.5,.99,1]).tolist(),
                'bad_steps':len(bad),'first_bad':[[int(i),float(t[i]),float(t[i+1])] for i in bad[:4]],
                'contains_zero':bool(np.any(t==0)),'has_left_zero':bool(t[0]<=0),'has_right_6s08':bool(t[-1]>=6.08),
                'clock_token_header':first.split()[0].decode(errors='replace')[:10]}),flush=True)
