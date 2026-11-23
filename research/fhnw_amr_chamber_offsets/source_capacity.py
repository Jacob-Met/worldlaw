"""Quantify how much the calibrated response projection can change a simpler array correction."""
import json,numpy as np
def diagnostic(a):
    M=a["response7"].reshape(189,3);U=np.tile(np.eye(3),(63,1));Q=np.linalg.qr(M)[0];B=np.linalg.qr(U)[0]
    cos=np.linalg.svd(B.T@Q,compute_uv=False);sin=np.sqrt(np.maximum(0,1-cos**2))
    P=Q@Q.T;G=B@B.T
    op=np.linalg.norm(P-G,2)
    assert abs(op-sin.max())<2e-12
    v=(a["pose_intercept7"].mean(0)-a["prior_chamber"]).ravel()
    measured=np.sqrt(np.mean((a["predictions"][0]-a["predictions"][2])**2))
    bound=float(op*np.sqrt(np.mean(v**2)))
    assert measured<=bound+1e-13
    # Heterogeneous unconstrained per-chip magnetic fields erase the three-parameter model.
    local=np.linalg.svd(a["response7"],compute_uv=False)
    return dict(basis_principal_angles_deg=np.rad2deg(np.arccos(np.clip(cos,0,1))).tolist(),
        sin_largest=float(sin.max()),projector_norm=float(op),candidate_minus_isotropic_rms=float(measured),max_possible_rms_given_current_offset_norm=bound,
        worst_local_condition=float(max(local[:,0]/local[:,-1])),minimum_local_singular=float(local[:,-1].min()))

if __name__=="__main__":
    import base64,hashlib,io
    from pathlib import Path
    root=Path(__file__).resolve().parent;raw=base64.b64decode((root/"forecast_bytes.txt").read_text().strip(),validate=True)
    assert hashlib.sha256(raw).hexdigest()==json.loads((root/"forecast_lock.json").read_text())["sha"]
    with np.load(io.BytesIO(raw),allow_pickle=False) as a:print(json.dumps(diagnostic(a),sort_keys=True))
