import json
import hashlib
from pathlib import Path
import sys
import numpy as np
import modal_response


def converted(x):
    if isinstance(x, np.ndarray):
        return x.tolist()
    if isinstance(x, np.generic):
        return x.item()
    raise TypeError(type(x))


def run(data):
    out = {}
    for mat, v in sorted(data.items()):
        if v["unresolved"]:
            raise ValueError("unresolved input table")
        dyn = {temp: np.asarray(rows).T for temp, rows in v["dynamic"].items()}
        if set(dyn) != {"0","10","20","30","40","50"}:
            raise ValueError("incomplete dynamic temperatures")
        for temp, rows in sorted(v["steady"].items()):
            rates,eta = np.array([r[:2] for r in rows]).T
            mask = [len(row[2]) >= 8 for row in rows]
            ref = [any(x[2] for x in row[2]) for row in rows]
            if len(rows) != (26 if mat=="2490" else 20):
                raise ValueError("incomplete torque coverage")
            out[mat + "/" + temp] = dict(
                rates=rates, torque_input_viscosity=eta, reported_force=mask, reference_flag=ref,
                **modal_response.predict(dyn,int(temp),rates,eta))
    if len(out)!=6 or sum(sum(c["reported_force"]) for c in out.values())!=70:
        raise ValueError("axial reporting roster mismatch")
    return out


if __name__=="__main__":
    out=run(json.loads(Path(sys.argv[1]).read_text()))
    data=(json.dumps(out,sort_keys=True,separators=(",",":"),default=converted,allow_nan=False)+"\n").encode()
    Path(sys.argv[2]).write_bytes(data)
    print("PREDICTION_SHA",hashlib.sha256(data).hexdigest(),len(data))
    for k,v in sorted(out.items()):
        mask=v["reported_force"]
        print(k, len(mask),sum(mask),v["minimum_relative_input_error"],v["relative_tolerance"],
              np.median((v["conditional_upper"][mask]-v["conditional_lower"][mask])/
                        np.maximum(v["laun"][mask],1e-12)))
