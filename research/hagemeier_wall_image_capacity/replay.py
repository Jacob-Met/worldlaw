"""Recount the signed model capacities from the two complete retained source-only originals."""
import hashlib
import json
import sys
from decimal import Decimal as D, localcontext
from pathlib import Path


def main(root):
    native = json.loads((root / "native-originals.json").read_text())
    assert native["directory"]["exit_code"] == 1
    for key in ("capacity", "integrator"):
        item = native[key]
        b = item["stdout"].encode()
        assert len(b) == item["stdout_bytes"]
        assert hashlib.sha256(b).hexdigest() == item["stdout_sha256"]
        assert item["exit_code"] == 0 and item["descendants"] == "drained"
    cap = json.loads(native["capacity"]["stdout"])
    sim = json.loads(native["integrator"]["stdout"])
    inputs = dict(Steel_16=("16.7","7729","1.68"), Steel_14=("14.4","7604","1.54"),
                  PTFE_20=("20","2170",".72"), PTFE_10=("10","2158",".51"),
                  PTFE_06=("6","2122",".38"), POM_20=("20","1351",".33"),
                  Rubber_22=("22","1361",".35"))
    assert len(cap["rows"]) == 42
    seen = set()
    with localcontext() as context:
        context.prec = 75
        for xx, value in cap["universal_maximum_slowing"].items():
            x = D(xx)
            expected = 1 - 1/(1 + D(1)/(8*x**3)).sqrt()
            assert abs(expected - D(value)) < D("1e-59")
        for row in cap["rows"]:
            d, rho, v = map(D, inputs[row["condition"]])
            alpha = D(3)/16/(rho/D(1141)+D(".5"))
            if "center_height_over_radius" in row:
                x = D(row["center_height_over_radius"])
                frac = 1 - 1/(1+alpha/x**3).sqrt()
                assert abs(frac-D(row["maximum_fractional_slowing"])) < D("1e-59")
                assert abs(frac*v*D("8.89") - D(row["one_frame_maximum_slowing_pixels_at_nominal"])) < D("1e-58")
                seen.add((row["condition"],str(x)))
            else:
                ti = (d/2)*alpha/(4*(v/2))*(D(1)/4-D(1)/100)
                assert abs(ti-D(row["conditional_extra_time_ceiling_ms"])) < D("1e-58")
                seen.add((row["condition"],"time"))
    assert len(seen) == 42 and cap["physical_files_read"] == sim["physical_files_read"] == 0
    runs = sim["runs"]
    expected = {(k,m,v) for k in inputs for m in (.5,1,2) for v in (.5,1,1.5)}
    assert {(r["condition"],r["multiplier"],r["start_ratio"]) for r in runs} == expected
    assert len(runs)==63 and max(r["maximum_inequality_violation"] for r in runs)<5e-12
    assert all(r["time_increment"] <= r["sampled_floor_time_ceiling"]+2e-11 for r in runs)
    assert sim["faster_candidate_counterexample_slope"]>0
    print(json.dumps(dict(capacity_rows=42,synthetic_ode_checks=63,empirical_reads=0,
                          independent_physical_comparisons=0),sort_keys=True))


if __name__=="__main__":
    main(Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parent)
