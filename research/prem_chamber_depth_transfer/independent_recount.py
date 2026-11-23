"""Independent stdlib-only raw-workbook, stored forecasts and error recount."""
import base64,hashlib,io,json,math,pathlib,struct,urllib.request,zipfile
import xml.etree.ElementTree as E
from decimal import Decimal as D, getcontext
getcontext().prec=55
P=pathlib.Path(".")
def get(n):return json.loads((P/n).read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
reg=get("protocol.json");score=get("raw-score.json");assert score["roles"]==reg["roles"]
arrays=[]
for i,s in enumerate(reg["transport"]["seeds"]):
    f=get(f"forecast-{s}.json");lock=get(f"forecast-lock-{s}.json")["forecast"]
    assert lock["protocol_sha"]==sha((P/"protocol.json").read_bytes()) and s==f["seed"]==lock["seed"] and lock["roles"]==reg["roles"]
    parts=[]
    for a,group in enumerate(f["vectors"]):
        assert len(group)==11
        for j,sequence in enumerate(group):
            p=struct.pack("<568d",*sequence);assert sha(p)==lock["digest"][a][j];parts.append(p)
    b=base64.b64decode(f["header"],validate=True)+b"".join(parts)
    assert sha(b)==lock["npy_sha"]==score["locks"][i] and len(b)==lock["npy_bytes"];arrays.append(f["vectors"])
req=urllib.request.Request("https://zenodo.org/records/6757550/files/lab_spectra.xlsx?download=1",headers={"User-Agent":"independent scientific workbook recount"})
with urllib.request.urlopen(req,timeout=80) as rr:raw=rr.read()
assert sha(raw)==reg["files"]["workbook"]
with zipfile.ZipFile(io.BytesIO(raw)) as z:root=E.fromstring(z.read("xl/worksheets/sheet3.xml"))
ns="{http://schemas.openxmlformats.org/spreadsheetml/2006/main}";cells={c.get("r"):c for c in root.iter(ns+"c")}
def values(c):return [float(cells[c+str(n)].find(ns+"v").text) for n in range(4,572)]
Y=[values("G"),values("K")];W=[values("E"),values("I")]
assert [sha(struct.pack("<568d",*a)) for a in Y]==score["truth_sha"]
md=0.;rawchecks=0;decision=[]
for q,A in enumerate(arrays):
    ss=score["replicates"][q];v=[]
    for unit,G in enumerate(A):
        row=[]
        for j,z in enumerate(G):
            e=[D.from_float(p)-D.from_float(y) for p,y in zip(z,Y[unit])]
            rm=(sum(x*x for x in e)/D(568)).sqrt();ma=sum(abs(x) for x in e)/D(568);row.append(rm)
            md=max(md,abs(float(rm)-ss["rmse"][unit][j]),abs(float(ma)-ss["mae"][unit][j]))
            k=max(range(568),key=lambda n:abs(e[n]));w=ss["maxima"][unit][j]
            assert w["bin"]==k and w["truth"]==Y[unit][k] and w["wavelength"]==W[unit][k] and w["forecast"]==z[k]
            md=max(md,abs(float(e[k])-w["signed_error"]))
        for x in ss["primary_worst_windows"][unit]:
            k=x["bin"];assert x["wavelength_um"]==W[unit][k] and x["truth"]==Y[unit][k] and list(x["forecast"])==[s[k] for s in G]
            for j in range(11):md=max(md,abs(float(D.from_float(G[j][k])-D.from_float(Y[unit][k]))-x["signed_errors"][j]));rawchecks+=1
        v.append(all(row[0]<row[j] for j in (1,5,6,7,8)))
    decision.append(all(v));assert all(v)==ss["gate"]
assert all(decision)==score["gate"] and md<1e-13
print(json.dumps({"locks":score["locks"],"whole_spectrum_metrics":88,"native_predictions_recounted":24992,"original_targets":1136,"role_worsts":44,"neighbors_and_roles_checked":rawchecks,"max_float_difference":md,"replicate_gates":decision,"joint_gate":all(decision)},sort_keys=True))
