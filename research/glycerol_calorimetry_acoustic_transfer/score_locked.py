"""Receive the signed historical PDF and the immutable pre-outcome forecasts."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess

FORECAST_SHA = "3b8ea53a8d9e5d15290e392a939e992e10c17f7a7b5170f92e379a117179e5bf"
PDF_SHA = "9ba6858c8d9624713314ccc080a6d33d4d578b2231b4fc8bba17e3c4b4a90026"
PROTOCOL_SHA = "018a44defce2f69bd600b60c013832fe10c7db1273115ad2f6a27002e0274f51"
INPUT_SHA = "9bbe6c663ba4ca28ce649bc420f1e244b66ae090f4d018277913dbbaef04cd75"

def authenticated(path, digest):
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError(f"source digest mismatch for {path.name}")
    return data

def targets(path):
    authenticated(path, PDF_SHA)
    text = subprocess.run(["pdftotext", "-raw", str(path), "-"], check=True,
                          capture_output=True, text=True).stdout
    table = re.split(r"(?m)^Table 12\s*\n", text)
    if len(table) != 2:
        raise ValueError("unique Table 12 heading required")
    block = re.split(r"(?m)^Table 13\s*\n", table[1], maxsplit=1)[0]
    if "Results of sound velocity measurements in glycerol." not in block[:100]:
        raise ValueError("unexpected Table 12 caption")
    pattern = r"(?m)^\s*(\d{3}\.\d+)\s+(\d{1,2}\.\d+)\s+Liquid\s+(\d{3,4}\.\d+)\b"
    parsed = [[float(value) for value in row] for row in re.findall(pattern, block)]
    if len(parsed) != 50 or len(re.findall(r"\bLiquid\b", block)) != 50:
        raise ValueError("incomplete historical measurements")
    return parsed

def summarize(rows, role):
    if any(isinstance(row["predicted"][role],dict) for row in rows):
        return {"rows":len(rows),"eligible":False,"refused":sum(isinstance(row["predicted"][role],dict) for row in rows)}
    errors = [row["predicted"][role]-row["observed"] for row in rows]
    worst = max(range(len(rows)), key=lambda i: abs(errors[i]))
    return {"rows":len(rows),"eligible":True,"mae":sum(map(abs,errors))/len(rows),
            "rmse":math.sqrt(sum(e*e for e in errors)/len(rows)),
            "mean_abs_percent":sum(100*abs(e)/row["observed"] for e,row in zip(errors,rows))/len(rows),
            "worst_abs":abs(errors[worst]),"worst_index":rows[worst]["index"]}

def receive(pdf, data_root):
    protocol = json.loads(authenticated(data_root/"protocol.json", PROTOCOL_SHA))
    roles = protocol["roles_in_order"]
    forecasts = json.loads(authenticated(data_root/"forecast-lock.json", FORECAST_SHA))
    states = json.loads(authenticated(data_root/"held-state-inputs.json", INPUT_SHA))
    if len(forecasts)!=50 or any(set(row["sound_m_s"])!=set(roles) for row in forecasts):
        raise ValueError("incomplete forecast inventory")
    observed = targets(pdf)
    if [r[:2] for r in observed] != states:
        raise ValueError("historical table physical input mismatch")
    rows=[]
    for i,(f,(t,p,speed)) in enumerate(zip(forecasts,observed)):
        if [f["T_K"],f["p_MPa"]] != [t,p] or f["index"] != i:
            raise ValueError("forecast grid mismatch")
        rows.append({"index":i,"T_K":t,"p_MPa":p,"nominal_T":round(t),
                     "primary":f["primary"],"thermal_support":f["thermal_support"],
                     "observed":speed,"predicted":f["sound_m_s"]})
    populations={"all":rows,"thermal_support":[r for r in rows if r["thermal_support"]],
                 "primary":[r for r in rows if r["primary"]],"outside_thermal":[r for r in rows if not r["thermal_support"]]}
    for temp in sorted({r["nominal_T"] for r in rows}):
        populations[f"all_T{temp}"]=[r for r in rows if r["nominal_T"]==temp]
    for temp in sorted({r["nominal_T"] for r in populations["primary"]}):
        populations[f"primary_T{temp}"]=[r for r in populations["primary"] if r["nominal_T"]==temp]
    metrics = {scope:{role:summarize(records,role) for role in roles} for scope,records in populations.items()}
    primary=metrics["primary"]
    rivals=roles[1:]
    points_pass=all(primary[role]["eligible"] for role in roles) and all(primary["gibbs"][m]<primary[r][m] for r in rivals for m in ("rmse","mean_abs_percent"))
    blocks_pass=all(metrics[key]["gibbs"]["rmse"]<min(metrics[key][r]["rmse"] for r in rivals)
                    for key in metrics if key.startswith("primary_T"))
    worst=rows[primary["gibbs"]["worst_index"]]
    return {"source_sha256":PDF_SHA,"forecast_sha256":FORECAST_SHA,"metrics":metrics,
            "primary_same_row_all_roles":worst,"primary_joint_pass":points_pass and blocks_pass,
            "by_isotherm_pass":blocks_pass,"primary_aggregate_pass":points_pass,"all_50_rows":rows}

if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("pdf",type=Path)
    parser.add_argument("--data-root",type=Path,default=Path(__file__).resolve().parent)
    parser.add_argument("--output",type=Path,required=True)
    args=parser.parse_args()
    result=receive(args.pdf,args.data_root)
    data=(json.dumps(result,sort_keys=True,indent=2,allow_nan=False)+"\n").encode()
    args.output.write_bytes(data)
    print(json.dumps({"rows":50,"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data),
                      "joint_pass":result["primary_joint_pass"],"primary":result["metrics"]["primary"],
                      "worst":result["primary_same_row_all_roles"]}))
