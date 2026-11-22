"""Cold-check every frozen forecast and reconstruct the complete gate without NumPy."""
import hashlib
import json
import math
from pathlib import Path
from aggregate import aggregate
from cascade import check


def main():
    root=Path(__file__).parent
    provenance=json.loads((root/"provenance.json").read_text())
    frozen=json.loads((root/"assessment.json").read_text())
    records=[]
    for i,entry in enumerate(provenance["records"]):
        b=(root/f"dev{i}.json").read_bytes()
        assert len(b)==entry["record_bytes"] and hashlib.sha256(b).hexdigest()==entry["record_sha256"]
        obj=json.loads(b)
        inputs=json.dumps(obj["locked"],sort_keys=True,allow_nan=False).encode()
        assert len(inputs)==entry["forecast_bytes"] and hashlib.sha256(inputs).hexdigest()==entry["forecast_sha256"]
        assert obj["locked"]["zip_sha256"]==entry["zip_sha256"]
        assert (obj["date"],obj["bead"])==(entry["date"],entry["bead"])
        records.append(obj)
    fresh=aggregate(records,"development")
    fresh["max_independent_raw_error"]=max(r["independent_raw_max_abs"] for r in records)
    assert fresh==frozen and not fresh["passed"] and fresh["component_forecasts_recounted"]==4080
    assert all(not value for comparison in fresh["gates"].values() for value in comparison.values())
    tail=json.loads((root/"worst_diagnostic.json").read_text())
    a=tail["observed_full_cv"]
    assert abs(a[0][1]-a[1][0])/2==tail["lag_distance_to_symmetric_matrices"]
    assert math.isclose(tail["max_cv_block_deviation_over_sigma_min"],max(tail["contiguous_block_cv_deviation_spectral_norm"])/min(tail["singular_values_cv"]),rel_tol=1e-14)
    raw=fresh["worst_raw_rows"]["quiet_positive_lag"]
    assert (raw["date"],raw["bead"],raw["command"],raw["index"])==(tail["date"],tail["bead"],tail["command"],tail["raw_index"])
    assert all(abs(a-b)<1e-12 for a,b in zip(raw["prediction"],tail["prediction"]))
    assert raw["observation"]==tail["observation"]
    print(json.dumps({"admission":fresh["passed"],"checked_component_forecasts":4080,
                      "scores":fresh["scores"],"raw_reader_error":fresh["max_independent_raw_error"],
                      "worst_positive_lag":raw,"pole_exchange":check(),"later_beads_opened":0},indent=2))


if __name__=="__main__":
    main()
