"""Verify archive membership, digest, axes, and all 81 per-spectrum locks before scoring."""
import hashlib,io,json,pathlib,sys,zipfile
import numpy as np
reg=json.load(open("protocol.json"));path=pathlib.Path(sys.argv[1]);manifest=json.load(open(path.with_name("manifest.json")))
orig=path.read_bytes();assert hashlib.sha256(orig).hexdigest()==sys.argv[2]==manifest["archive_sha"]
assert len(orig)==manifest["archive_bytes"] and manifest["held_opens_decoded"]==0
assert hashlib.sha256(open("protocol.json","rb").read()).hexdigest()==manifest["protocol_sha"] and manifest["roles"]==reg["roles"]
with zipfile.ZipFile(io.BytesIO(orig)) as archive:assert sorted(archive.namelist())==["frequencies.npy","predictions.npy"]
with np.load(io.BytesIO(orig),allow_pickle=False) as z:
    A=z["predictions"];f=z["frequencies"]
assert A.dtype.str=="<c8" and A.shape==(9,19501,3,3) and np.isfinite(A).all()
assert hashlib.sha256(f.astype("<f8").tobytes()).hexdigest()==reg["frequency"]["sha256"]
digests={f"{r}/{u}/{l}":hashlib.sha256(A[r,:,i,j].tobytes()).hexdigest() for r in range(9) for i,u in enumerate(reg["upper"]) for j,l in enumerate(reg["held_lower"])}
assert digests==manifest["digests"]
print(json.dumps(dict(archive_sha=sys.argv[2],archive_bytes=len(orig),forecast_cells=int(A.size),spectrum_digests=len(digests),protocol_sha=manifest["protocol_sha"],all_verified=True),sort_keys=True))
