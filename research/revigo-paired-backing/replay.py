"""Reproduce four measured Revigo drawdowns and the independent Decimal recount."""

import argparse
import contextlib
import hashlib
import io
import json
import tempfile
import urllib.request
from decimal import getcontext
from pathlib import Path

import development
import independent_recount
from calibration_and_slab import run as calibrate_roles
from raw_diagnostics import diagnostic

SOURCE = "https://raw.githubusercontent.com/fligt/revigo-spectra/f09ed729f0826f0161b70ecb125fe597b31ea297/data/"
INPUT_FILES = {
    "design": "revigo-mixture-specifications.txt",
    "spectra": "revigo-aggregated-palette-spectral-data.txt",
}
HERE = Path(__file__).resolve().parent

def capture(function, *args):
    output = io.StringIO()
    with contextlib.redirect_stdout(output):
        function(*args)
    return json.loads(output.getvalue())

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path,
                        help="Use local copies of the two original author-named text files")
    args = parser.parse_args()
    reference = json.loads((HERE / "comparison.json").read_text())
    with tempfile.TemporaryDirectory(prefix="revigo-replay-") as work:
        root = Path(work)
        for name, original in INPUT_FILES.items():
            if args.source_dir:
                buf = (args.source_dir / original).read_bytes()
            else:
                with urllib.request.urlopen(SOURCE + original, timeout=90) as response:
                    buf = response.read()
            if hashlib.sha256(buf).hexdigest() != reference["source_sha256"][name]:
                raise ValueError(f"Wrong original source bytes for {original}")
            (root / name).write_bytes(buf)
        qualification = capture(calibrate_roles, root)
        assert qualification["calibration_count"] == 72
        assert qualification["skipped_count"] == 48
        assert qualification["synthetic_transfer"]["count"] == 480
        forecast = capture(development.development, root)
        traces = capture(diagnostic, root)
        getcontext().prec = 50
        receipt = capture(independent_recount.check, (root / "spectra").read_bytes(),
                          forecast, traces)
    assert receipt["measured_audit"] == reference["recount"]["measured_audit"]
    assert receipt["recounted_scalar_residuals"] == 744
    assert len(forecast["rows"]) == 4 and len(forecast["per_arm"]) == 6
    deviation = 0.
    for recipe, result in forecast["rows"].items():
        expected = reference["development"]["rows"][recipe]
        for arm, values in result["registered_predictions"].items():
            frozen = expected["registered_predictions"][arm]
            assert len(values) == len(frozen) == 31
            deviation = max(deviation, max(abs(l-r) for l,r in zip(values,frozen)))
    if deviation > 2.e-6:
        raise ValueError(f"Frozen forecast departure {deviation:g}")
    for recipe, expected in reference["raw_witnesses"].items():
        row = next(v for v in traces[recipe]["records"] if v["nm"] == expected["nm"])
        for name in ("bare_b", "bare_w", "painted_b", "painted_w"):
            assert abs(row[name] - expected[name]) < 1.e-14
        assert row["branch"] == expected["branch"]
        if expected["d_predicted_white_d_observed_black"] is not None:
            assert abs(row["d_predicted_white_d_observed_black"]
                       - expected["d_predicted_white_d_observed_black"]) < .01
    candidate = forecast["per_arm"]["spectral_thickness_eliminated"]
    for comparator in ("nominal_author_family", "nominal_plus_measured_black_residual",
                       "all_band_common_thickness", "empirical_local_gap"):
        assert all(candidate[metric] > forecast["per_arm"][comparator][metric]
                   for metric in ("mean_equal_film", "worst_film"))
    print(json.dumps({"recipes": 4, "arms": 6, "recounted": 744, "final_opened": 0,
                      "max_frozen_forecast_difference": deviation,
                      "metrics": forecast["per_arm"]}, sort_keys=True))

if __name__ == "__main__":
    main()
