"""Recount all eight response-control curves against the fixed five-arm registry."""
import hashlib
import json

import numpy as np

from mat_source import project, SOURCE_SHA256

ROSTER={"spatial-energy","author-PFF","constant-linear","constant-shape","acceleration-only"}
PROTOCOL="ed1bacb82d31408d1a5ca0a382e12fdc2f63a33e2a92be8f1bf6f71bb155a4c7"
LAW_SHA="98d702721760ef3047379ce658794fc86fa611fc4d8a7ca81cc8800e1d74b10f"


def score(raw_source, forecast_bytes, registry_sha, law_sha=LAW_SHA):
    if hashlib.sha256(forecast_bytes).hexdigest()!=registry_sha:
        raise ValueError("Prediction registry digest changed")
    pred=json.loads(forecast_bytes)
    assert pred["protocol"]==PROTOCOL and pred["laws_sha256"]==law_sha
    assert pred["forced_mat_sha256"]==SOURCE_SHA256 and pred["force_control_decoded"] is False
    assert pred["RC_force_or_phase_decoded"] is False and len(pred["curves"])==8
    for i,c in enumerate(pred["curves"]):
        assert c["index"]==i and set(c["models"])==ROSTER
        n=len(c["frequency_hz"])
        assert n==len(c["conditioning_acceleration_amplitude"]) and n>0
        for arm, model in c["models"].items():
            for k in ("normalized_force","folded_phase_deg"):
                assert len(model[k])==n and np.isfinite(model[k]).all()
            assert abs(np.sqrt(np.mean(np.square(model["normalized_force"])))-1)<1e-10
    outcomes=project(raw_source,read_outcomes=True)
    curves=[]; nrows=0
    for c,y in zip(pred["curves"],outcomes):
        force,phase=y["force"],y["phase"]
        assert len(force)==len(phase)==len(c["frequency_hz"])
        assert np.isfinite(force).all() and np.isfinite(phase).all() and np.all(force>=0)
        rms=float(np.sqrt(np.mean(force**2)))
        if not np.isfinite(rms) or rms<=0:raise ValueError("Invalid full-curve force RMS")
        nrows+=len(force)
        normalized=force/rms; phi=np.deg2rad(phase)
        folded=np.rad2deg(np.arctan2(abs(np.sin(phi)),abs(np.cos(phi))))
        per_arm={}
        for arm,m in c["models"].items():
            ep=np.asarray(m["folded_phase_deg"])-folded
            ef=np.asarray(m["normalized_force"])-normalized
            row={"phase_mae_deg":float(np.mean(abs(ep))),"force_shape_rmse":float(np.sqrt(np.mean(ef**2))),
                 "clamped_lower":m["clamped_lower"],"clamped_upper":m["clamped_upper"]}
            for label,k in (("worst_phase",int(np.argmax(abs(ep)))),("worst_shape",int(np.argmax(abs(ef))))):
                row[label]={"row":k,"frequency_hz":c["frequency_hz"][k],
                            "conditioned_acceleration_amplitude":c["conditioning_acceleration_amplitude"][k],
                            "observed_force_N":float(force[k]),"curve_force_RMS_N":rms,
                            "observed_phase_deg":float(phase[k]),"observed_folded_deg":float(folded[k]),
                            "predicted_folded_deg":m["folded_phase_deg"][k],
                            "observed_force_shape":float(normalized[k]),"predicted_force_shape":m["normalized_force"][k],
                            "phase_miss_deg":float(ep[k]),"shape_miss":float(ef[k])}
            per_arm[arm]=row
        curves.append({"index":c["index"],"steps":len(force),"direction":c["direction_steps"],
                       "observed_force_rms_N":rms,"per_arm":per_arm})
    table={}
    for arm in sorted(ROSTER):
        p=[c["per_arm"][arm]["phase_mae_deg"] for c in curves]
        f=[c["per_arm"][arm]["force_shape_rmse"] for c in curves]
        table[arm]={"macro_phase_mae_deg":float(np.mean(p)),"macro_force_shape_rmse":float(np.mean(f)),
                    "worst_curve_shape_rmse":max(f),"per_curve_phase_mae_deg":p,"per_curve_shape_rmse":f}
    a,b=table["spatial-energy"],table["author-PFF"]
    gates={"macro_phase_beats_PFF":a["macro_phase_mae_deg"]<b["macro_phase_mae_deg"],
           "macro_shape_beats_PFF":a["macro_force_shape_rmse"]<b["macro_force_shape_rmse"],
           "worst_curve_shape_not_worse":a["worst_curve_shape_rmse"]<=b["worst_curve_shape_rmse"]}
    return {"protocol":PROTOCOL,"forecast_sha256":registry_sha,"law_sha256":law_sha,"forced_mat_sha256":SOURCE_SHA256,
            "RC_curves":len(curves),"points":nrows,"FC_curves_decoded":0,"metrics":table,"curves":curves,
            "gates":gates,"primary_joint":all(gates.values())}
