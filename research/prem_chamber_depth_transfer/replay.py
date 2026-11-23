"""Offline receipt verification of original arrays, native metrics and raw extreme rows."""
import base64,hashlib,json,math,pathlib,struct,sys
p=pathlib.Path(sys.argv[1])
def read(n):return json.loads((p/n).read_text())
def sha(b):return hashlib.sha256(b).hexdigest()
reg=read("protocol.json");score=read("raw-score.json")
assert score==json.loads((p/"score-original.txt").read_text().splitlines()[-1])
assert score["residuals"]==24992 and score["measured_cells"]==1136
ind=json.loads((p/"independent-original.txt").read_text().splitlines()[-1])
assert ind["locks"]==score["locks"] and ind["max_float_difference"]<1e-13 and ind["native_predictions_recounted"]==24992
syn=json.loads((p/"synthetic-original.txt").read_text().splitlines()[-1])
assert syn["all_layer_maximum_standard_errors"]<7 and max(syn["pure_absorption_analytic_maximum_standard_errors"].values())<7
decisions=[]
for q,seed in enumerate(reg["transport"]["seeds"]):
    f=read(f"forecast-{seed}.json");lock=read(f"forecast-lock-{seed}.json")["forecast"]
    assert f["seed"]==seed==lock["seed"] and lock["roles"]==score["roles"]==reg["roles"] and lock["held_sle_read"]==0
    assert sha((p/"protocol.json").read_bytes())==lock["protocol_sha"]
    payload=base64.b64decode(f["header"],validate=True);res=score["replicates"][q]
    for u,mat in enumerate(f["vectors"]):
        assert len(mat)==11
        for j,y in enumerate(mat):
            b=struct.pack("<568d",*y);assert sha(b)==lock["digest"][u][j];payload+=b
            w=res["maxima"][u][j];assert y[w["bin"]]==w["forecast"] and y[w["bin"]]-w["truth"]==w["signed_error"]
        for row in res["primary_worst_windows"][u]:
            vals=[x[row["bin"]] for x in mat];assert vals==row["forecast"] and [x-row["truth"] for x in vals]==row["signed_errors"]
    assert sha(payload)==lock["npy_sha"]==score["locks"][q] and len(payload)==lock["npy_bytes"]
    passed=all(r[0]<r[j] for r in res["rmse"] for j in [1,5,6,7,8]);decisions.append(passed);assert passed==res["gate"]
assert all(decisions)==score["gate"]==ind["joint_gate"] and decisions==ind["replicate_gates"]
print("Both original NumPy files and all 44 spectra verified; joint directional gate",score["gate"])
