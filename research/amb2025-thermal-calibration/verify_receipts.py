"""Verify the published calibration results without reading any held answer."""
from pathlib import Path
import hashlib
import json
import math

HERE=Path(__file__).resolve().parent
PINS={
    "calibration-fit.json": "8a520845a479b59e171c2da3b9fc7c44230b2bc03e341e1fbc8836d92e6ed1d4",
    "calibration-temporal.json": "b12c614f4f8a9696f4ca8f3697a357b1b473c22706645791837f9f761f23d50b",
    "calibration_receiver.py": "e84de894637f27bb6cc848286b0765d66eef38074eaecf75e48ff5af451df513",
    "convergence.json": "08fb50fa7f50aa36d88289ae2c2910cd593c35f8ca9415835c5a95ca33181da2",
    "fit_calibration.py": "801f0ff9ca8322cfc5f14eecfaaa6ad1636ee2a08a4adc68b766186dd237f32c",
    "geometry_certificate.py": "1bdc1fc19699f4990bfb4c1d3e46246fa6e584d9317e7df77d44cdaab43bc587",
    "native-originals.json": "46c0d8b57485cf750fce0a24c3168eb5046ec49e6d76be7956b40bd33f3cc1a5",
    "solver-tree.json": "1c9608a81439787f2c9055672acdb6f49b6d224b756ded1d20abcb2895efa526",
    "source-contract.json": "90e4de7c2740d4ef044de2f36807598d8482d53a915f0c40c3acf7129d578ecb",
    "source-receipts.json": "9820389601cb2d2953133320670ec258d10bb225db0b32f9e842f299e23c3599",
    "team-source-census.json": "44d288eb00f641f2b0d3d57f0c7c8979d08fa8daa7dc03423b98b43a09754542"
}

def read(name):
    return json.loads((HERE/name).read_bytes())

def main():
    for name,sha in PINS.items():
        assert hashlib.sha256((HERE/name).read_bytes()).hexdigest()==sha,name
    roster=read("source-contract.json")
    calibration=roster["pre_challenge_geometry"]
    assert calibration["independent_tracks"]==3 and calibration["cross_sections_per_track"]==2
    w,d=calibration["means_um"];u_w,u_d=calibration["combined_expanded_uncertainty_k2_um"]
    assert math.isclose(2*(d-u_d)-(w+u_w),81.3)
    assert all(2*y>x for x,y in zip(calibration["width_um"],calibration["depth_um"],strict=True))
    f=read("calibration-fit.json")["convergence"]["384"]
    assert f["surface_admissible"] and f["stretch_admissible"] and f["volume_admissible"]
    assert math.isclose(f["stretch"]*f["surface_depth_um"],d,rel_tol=1e-12)
    assert math.isclose(f["surface_eta"]*f["stretch"],f["stretch_eta"],rel_tol=1e-12)
    independent=read("calibration-temporal.json")
    sample=independent["sweep"]["1024"]
    bounds=independent["source_shape_with_bead_bounds_um2"]
    for role,lo in sample.items():
        area=lo["area_under_surface_um2"]
        flags=[a<=area<=b for a,b in bounds]
        assert flags==lo["within_area_window"]
        assert sum(flags)==(6 if role=="normal_volume" else 0)
        for record in lo["traces"].values():
            a,b,c,d2=record["crossings_s"]
            assert a<b<c<d2
            assert math.isclose(record["TAM_us"],1e6*(b-a)) and math.isclose(record["SCR_K_per_s"],110/(d2-c))
    for where,entry in sample["surface"]["traces"].items():
        for field in ["peak_C","TAM_us","SCR_K_per_s"]:
            assert math.isclose(entry[field],sample["depth_stretch"]["traces"][where][field],rel_tol=1e-10)
    assert sample["normal_volume"]["traces"]["0"]["TAM_us"]>sample["surface"]["traces"]["0"]["TAM_us"]+170
    errors=read("convergence.json")["area_deltas_um2"]
    assert errors["normal_volume"][0]>3 and all(v[-1]<0.02 for v in errors.values())
    assert independent["pad_answers_read"]==0 and not any(roster["holdout_access"].values())
    jobs=read("native-originals.json")
    assert len(jobs)==6 and sum(j["state"]=="failed" for j in jobs)==2
    assert all(j["descendants"]=="drained" for j in jobs)
    print("Verified six calibration sections from three tracks, three models, two independent quadratures, four crossing locations and zero held pad scores.")

if __name__=="__main__":
    main()
