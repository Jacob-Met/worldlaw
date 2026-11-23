"""Check inverse Masing and instrument phase witnesses without experimental loop values."""
import argparse
from fractions import Fraction as Q
import hashlib
from itertools import product
import json
from pathlib import Path, PurePosixPath
import re
import zipfile


def backbone(force):
    return force + force**2 / 3 + force**3 / 17


def gap(peak, force, compliance, changed=False):
    def q(value):
        return backbone(value) + (value**2 / 11 if changed else 0)

    series = compliance * force**3
    ascending = -q(peak) + 2 * q((peak + force) / 2) + series
    descending = q(peak) - 2 * q((peak - force) / 2) + series
    return (descending - ascending) / 2


def contrast_controls():
    checked = degenerate = state_changes = 0
    for x, y, z in product(map(Q, range(1, 7)), repeat=3):
        a, c, peak = x + y, y + z, x + y + z
        prediction = gap(c, y-z, Q(2, 7)) - gap(a, x-y, Q(1, 5))
        f1, f2 = x+y-z, x-y-z
        observed = gap(peak, f1, Q(5, 3)) - gap(peak, f2, Q(5, 3))
        assert observed == prediction
        checked += 1
        if x == z:
            assert prediction == 0
            degenerate += 1
        else:
            changed = gap(peak, f1, Q(5, 3), True) - gap(peak, f2, Q(5, 3), True)
            assert changed != prediction
            state_changes += 1
    p, coefficient = Q(5), Q(3, 5)
    added_backbone_work = 8 * 3*coefficient*p**4/4 - 4*p*coefficient*p**3
    assert added_backbone_work == 2*coefficient*p**4
    return {"triples": checked, "equal_peak_tautologies": degenerate,
            "different_held_state_falsifiers": state_changes,
            "added_cubic_series_backbone_work": str(added_backbone_work)}


def single_peak_controls():
    equalities = convex_grids = 0
    for peak, degree, slope in product(map(Q, (1, 3, 7)), (1, 2, 4, 6), (Q(1, 7), Q(3))):
        def half_gap(force):
            return 1 - (abs(force) / peak)**degree

        def q(force):
            linear = slope * force
            if force <= peak / 2:
                return linear
            return linear + half_gap(Q(0)) - half_gap(2*force-peak)

        grid = [i*peak/128 for i in range(129)]
        values = [q(s) for s in grid]
        increments = [b-a for a, b in zip(values, values[1:])]
        assert min(increments) > 0 and increments == sorted(increments)
        convex_grids += 1
        for s in grid:
            assert q(peak)-q(s)-q(peak-s) == half_gap(2*s-peak)
            equalities += 1
    return {"convex_grids": convex_grids, "exact_gap_equalities": equalities}


def circle(parameter):
    denominator = 1 + parameter**2
    return (1-parameter**2)/denominator, 2*parameter/denominator


def phase_controls():
    comparisons = 0
    for omega, stiffness, amplitude, phase in product(
            map(Q, (3, 5, 11)), (Q(3, 7), Q(2)), map(Q, (1, 5, 9)), (Q(1, 7), Q(2, 3))):
        cosine_delta, sine_delta = circle(phase)
        elastic = stiffness*cosine_delta
        viscous = stiffness*sine_delta/omega
        for i in range(-16, 17):
            cosine, sine = circle(Q(i, 4))
            recorded_x = amplitude*cosine
            recorded_v = -amplitude*omega*sine
            delayed_displacement_model = stiffness*amplitude*(cosine*cosine_delta-sine*sine_delta)
            synchronous_model = elastic*recorded_x + viscous*recorded_v
            assert synchronous_model == delayed_displacement_model
            comparisons += 1
        assert viscous*omega*amplitude**2 == stiffness*sine_delta*amplitude**2 > 0
    return {"equal_force_displacement_rows": comparisons}


def clock_controls():
    spacing = Q(100000, 175)
    def ceil(value):
        return -(-value.numerator // value.denominator)
    starts = [ceil(k*spacing) for k in range(8)]
    lengths = [b-a for a, b in zip(starts, starts[1:])]
    assert lengths.count(572) == 3 and lengths.count(571) == 4
    kept = [starts[k]-k*spacing for k, size in enumerate(lengths) if size == 571]
    assert sorted(kept) == [Q(i, 7) for i in (3, 4, 5, 6)]
    return {"nominal_lengths": lengths, "kept_start_offsets_samples": list(map(str, kept))}


def verify_archive(path, expected):
    if path.stat().st_size != expected["bytes"]:
        raise ValueError(f"{expected['rig']}: archive size mismatch")
    codes = {}
    raw_count = matlab_count = 0
    directories = {"raw_data": set(), "Post_processed_hysteresis": set()}
    id_pattern = re.compile(re.escape(expected["folder_prefix"]) + r"(\d+)")
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        for member in members:
            path_in_zip = PurePosixPath(member.filename.replace(chr(92), "/"))
            suffix = path_in_zip.suffix.lower()
            raw_count += suffix == expected["raw_extension"]
            matlab_count += suffix == ".m"
            parts = path_in_zip.parts if member.is_dir() else path_in_zip.parts[:-1]
            for dirname, ids in directories.items():
                if dirname in parts:
                    for part in parts[parts.index(dirname)+1:]:
                        match = id_pattern.fullmatch(part)
                        if match:
                            ids.add(int(match.group(1)))
            if path_in_zip.name in (expected["reader"], expected["extractor"]):
                if path_in_zip.name in codes:
                    raise ValueError("duplicate author script")
                codes[path_in_zip.name] = hashlib.sha256(archive.read(member)).hexdigest()
    checks = {
        "archive_entries": len(members) == expected["entries"],
        "raw_member_count": raw_count == expected["raw_members"],
        "matlab_sources": matlab_count == expected["matlab_sources"],
        "raw_folder_ids": sorted(directories["raw_data"]) == expected["folder_ids"],
        "derived_folder_ids": sorted(directories["Post_processed_hysteresis"]) == expected["folder_ids"],
        "author_reader": codes.get(expected["reader"]) == expected["reader_sha256"],
        "author_extractor": codes.get(expected["extractor"]) == expected["extractor_sha256"],
    }
    if not all(checks.values()):
        raise ValueError(f"{expected['rig']}: {checks}")
    return checks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--imperial", type=Path)
    parser.add_argument("--polito", type=Path)
    args = parser.parse_args()
    if (args.imperial is None) != (args.polito is None):
        parser.error("supply both original archive paths together")
    ledger = json.loads(Path(__file__).with_name("source-ledger.json").read_text())
    if sum(len(rig["folder_ids"]) for rig in ledger["archives"]) != 76:
        raise ValueError("specimen folder roster mismatch")
    report = {"contrast": contrast_controls(), "single_peak": single_peak_controls(),
              "phase": phase_controls(), "clock": clock_controls(), "empirical_score": None}
    if args.imperial:
        report["archive_checks"] = {
            rig["rig"]: verify_archive(path, rig)
            for path, rig in zip((args.imperial, args.polito), ledger["archives"], strict=True)
        }
    print(json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
