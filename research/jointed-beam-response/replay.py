#!/usr/bin/env python3
"""Replay the conditional HBRB force-shape and phase comparison from official files."""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path
from urllib.request import urlopen

import numpy as np
from scipy.io import loadmat

from mat_source import project, SOURCE_SHA256
from mode_law import build_laws, predict
from recount import reference_curves, run
from score_curves import PROTOCOL, LAW_SHA, score

HERE=Path(__file__).parent
BEAM="https://raw.githubusercontent.com/mattiacenedese/BRBtesting/2d42d3a618206da58642674d3287ae34dfc7d5e5/"
SSM="https://raw.githubusercontent.com/haller-group/SSMLearn/305581114f62239b70c1fe44bce69cbf939326ea/examples/brakereussbeam/"
FILES={
    "ShakerRingdown.mat":(BEAM,"a62c551e34cc45257257d4e683cc9406beec2cbc1c7270329658fd9033de2f4a"),
    "data.mat":(SSM,"4611e6dad7a9bf096dc317e5b1b53f192feb8358b061c7102ca266dcf19e9e49"),
    "ForcedFrequencyResponses.mat":(BEAM,SOURCE_SHA256),
}


def source(root,name):
    host,h=FILES[name]
    if root is None:
        with urlopen(host+name,timeout=150) as response:
            b=response.read()
    else:
        b=(root/name).read_bytes()
    if hashlib.sha256(b).hexdigest()!=h:
        raise ValueError("Author source digest mismatch for "+name)
    return b


def training(root):
    package=loadmat(io.BytesIO(source(root,"ShakerRingdown.mat")),simplify_cells=True)
    s=loadmat(io.BytesIO(source(root,"data.mat")),simplify_cells=True)["data_BRB"]
    a=package["SRDdataAcc"];d=package["SRDdataDIC"];p=s["PFFResultsACC"]
    return {"tacc":a["time"],"acc3":a["acc3"],"tdic":d["time"],"position_cm":d["position"],
            "lower_mm":d["deflection_below"],"ssm_tacc":s["TimeACC"],"ssm_acc":s["AccelerationACC"],
            "ssm_loc":s["LocationACC"],"pff_t":p["Time"],"pff_zeta":p["Damping"],
            "pff_hz":p["Frequency"],"pff_amplitude":p["Amplitude"]}


def radian_sensitivity(original, curves):
    """Apply the measured MAT radian convention to the unchanged forecasts."""
    truth=reference_curves(original)
    result={}
    for name in curves[0]["models"]:
        errors=[]
        worst=None
        for observed,c in zip(truth,curves):
            phase=observed["phase"]
            folded=[math.degrees(math.atan2(abs(math.sin(y)),abs(math.cos(y)))) for y in phase]
            predicted=c["models"][name]["folded_phase_deg"]
            residual=[p-q for p,q in zip(predicted,folded)]
            errors.append(math.fsum(abs(v) for v in residual)/len(phase))
            j=max(range(len(residual)),key=lambda k:abs(residual[k]))
            if worst is None or abs(residual[j])>abs(worst["signed_miss_deg"]):
                worst={"curve":c["index"],"row":j,"frequency_hz":c["frequency_hz"][j],
                       "conditioned_acceleration_m_s2":c["conditioning_acceleration_amplitude"][j],
                       "observed_phase_rad":phase[j],"observed_folded_deg":folded[j],
                       "predicted_folded_deg":predicted[j],"signed_miss_deg":residual[j]}
        result[name]={"macro_phase_mae_deg":math.fsum(errors)/len(errors),"per_curve_phase_mae_deg":errors,"worst":worst}
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data-dir",type=Path,help="Directory containing the three unmodified author MAT files")
    p.add_argument("--check",action="store_true",help="Require the registered gates and numeric estimates to reproduce")
    p.add_argument("--details",action="store_true",help="Include per-curve worst observations")
    args=p.parse_args()
    laws,diagnostic=build_laws(training(args.data_dir))
    probes=np.linspace(79.,82.,61); amps=np.full(61,12.); gauge=0.
    for law in laws.values():
        first=predict(law,probes,amps)
        scaled=dict(law,mass=(np.asarray(law["mass"])*11).tolist())
        second=predict(scaled,probes,amps)
        for col in ("normalized_force","folded_phase_deg"):
            gauge=max(gauge,float(np.max(abs(np.asarray(first[col])-second[col]))))
    law_record={"registered_protocol":PROTOCOL,
                "projection":"a995ec3af88aab8436bd254170240e0ddadc4d37863bd1bb6b8a532fd88dc637",
                "raw_force_or_phase_access":False,"raw_RC_inputs_access":False,
                "diagnostic":diagnostic,"gauge11_worst":gauge,"laws":laws}
    law_sha=hashlib.sha256(json.dumps(law_record,sort_keys=True,allow_nan=False).encode()).hexdigest()
    whole=source(args.data_dir,"ForcedFrequencyResponses.mat")
    inputs=project(whole,False)
    curves=[]
    for i,row in enumerate(inputs):
        hz,acc=row["frequency"],row["amplitude"]
        diffs=np.diff(hz)
        steps={"increasing":int(sum(diffs>0)),"decreasing":int(sum(diffs<0)),"unchanged":int(sum(diffs==0))}
        curves.append(dict(index=i,direction_steps=steps,frequency_hz=hz.tolist(),conditioning_acceleration_amplitude=acc.tolist(),
                           models={name:predict(law,hz,acc) for name,law in laws.items()}))
    pred={"protocol":PROTOCOL,"laws_sha256":law_sha,"forced_mat_sha256":SOURCE_SHA256,
          "force_control_decoded":False,"RC_force_or_phase_decoded":False,"curves":curves}
    b=json.dumps(pred,sort_keys=True,allow_nan=False).encode()
    sha=hashlib.sha256(b).hexdigest()
    r=score(whole,b,sha,law_sha=law_sha)
    independent=run(whole,pred,r)
    sensitivity=radian_sensitivity(whole,curves)
    expected=json.loads((HERE/"frozen_result.json").read_text())
    differences=[abs(value-expected["metrics"][arm][k]) for arm,metrics in r["metrics"].items()
                 for k,value in metrics.items() if isinstance(value,(int,float))]
    for arm,data in sensitivity.items():
        differences.append(abs(data["macro_phase_mae_deg"]-expected["radian_sensitivity"][arm]["macro_phase_mae_deg"]))
    result={"source_rows":r["points"],"curves":r["RC_curves"],"FC_curves_decoded":0,"source_alignment":diagnostic,
            "original_model_record_sha256":LAW_SHA,"recomputed_model_record_sha256":law_sha,
            "recomputed_forecast_sha256":sha,"original_forecast_sha256":expected["forecast_sha256"],
            "forecast_hash_matches_original":sha==expected["forecast_sha256"],"registered_degree_metrics":r["metrics"],
            "registered_joint":r["primary_joint"],"registered_gates":r["gates"],"source_unit_corrected_phase":sensitivity,
            "source_unit_corrected_joint":bool(sensitivity["spatial-energy"]["macro_phase_mae_deg"]<sensitivity["author-PFF"]["macro_phase_mae_deg"] and
                                               r["gates"]["macro_shape_beats_PFF"] and r["gates"]["worst_curve_shape_not_worse"]),
            "independent_scalar_recount":independent,"maximum_summary_delta":max(differences)}
    if args.details:result["per_curve"]=r["curves"]
    print(json.dumps(result,sort_keys=True,indent=2,allow_nan=False))
    if args.check and (max(differences)>1e-7 or r["gates"]!=expected["gates"]):
        raise SystemExit("Frozen primary metrics or gates differ")


if __name__=="__main__":
    main()
