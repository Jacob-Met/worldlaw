"""Authenticate the public training voltage course and optionally rerun its two receivers."""
import argparse
import csv
import hashlib
import io
import json
import math
import struct
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT=Path(__file__).resolve().parent
ARCHIVE_SHA="68662a383ef4799767f1a59ad9327a6bffb320982a7bc532cbac59b6e02abb1e"
ARCHIVE_BYTES=117362


def digest(data):
    return hashlib.sha256(data).hexdigest()


def stored_csv_arrays(man):
    out={}
    for case in man["physical_training_phantoms"]:
        with (ROOT/f"locked-training-phantom-{case}.csv").open(newline="") as source:
            reader=csv.DictReader(source)
            assert reader.fieldnames==["edge_1based","query_col_1based"]+man["roles"]
            rows=list(reader)
        assert len(rows)==434
        for slot,row in enumerate(rows):
            assert int(row["edge_1based"])==1+slot//14 and int(row["query_col_1based"])==man["columns_one_based"][slot%14]
        for role in man["roles"]:
            name=f"phantom{case}/{role}.f64le"
            values=[float(row[role]) for row in rows]
            assert all(math.isfinite(x) for x in values)
            data=struct.pack("<434d",*values)
            assert digest(data)==man["sha256"][name]
            out[name]=data
    assert len(out)==33 and set(out)==set(man["sha256"])
    return out


def archive_bytes(out,manifest):
    members={**out,"manifest.json":manifest}
    buffer=io.BytesIO()
    with ZipFile(buffer,"w") as z:
        for name,data in sorted(members.items()):
            entry=ZipInfo(name,(1980,1,1,0,0,0));entry.compress_type=ZIP_DEFLATED;z.writestr(entry,data)
    return buffer.getvalue()


def check_score(a,b):
    assert a["archive_sha256"]==b["sha256"]==ARCHIVE_SHA and len(a["per_phantom"])==3
    assert a["primary_core"]==b["core"] and a["stronger_controls"]==b["strong"] and a["joint"]==b["joint"]
    for case,arms in a["per_phantom"].items():
        assert set(arms)==set(a["mean_phantom_rmse_V"])==set(b["all"][case]) and len(arms)==11
        for role,vals in arms.items():
            other=b["all"][case][role]
            for field in ["rmse_V","mae_V"]:
                assert abs(vals[field]-other[field])<1e-13
            assert len(vals["per_pattern_rmse_V"])==len(other["per_pattern_rmse_V"])==14
            assert all(abs(x-y)<1e-13 for x,y in zip(vals["per_pattern_rmse_V"],other["per_pattern_rmse_V"]))
            assert [vals["worst"][k] for k in ("edge","col","prediction_V","target_V","abs_error_V")]==other["worst"]
    return a["mean_phantom_rmse_V"]["reference_reciprocal_gls"]


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--archive",type=Path,help="Read the original ZIP instead of deterministically rebuilding it from complete rendered voltages.")
    p.add_argument("--write-archive",type=Path)
    p.add_argument("--score",action="store_true",help="Score the three public training cases with the two frozen and independent numerical receivers.")
    args=p.parse_args()
    for name,expected in json.loads((ROOT/"source-checksums.json").read_text()).items():
        assert digest((ROOT/name).read_bytes())==expected,name
    m=(ROOT/"locked-array-manifest.json").read_bytes(); manifest=json.loads(m)
    raw=stored_csv_arrays(manifest)
    arc=args.archive.read_bytes() if args.archive else archive_bytes(raw,m)
    assert len(arc)==ARCHIVE_BYTES and digest(arc)==ARCHIVE_SHA
    if args.write_archive:args.write_archive.write_bytes(arc)
    lines=(ROOT/"two-receivers-native-original.txt").read_text().splitlines()
    assert len(lines)==2
    a,b=[json.loads(line.split(" ",1)[1]) for line in lines]
    primary=check_score(a,b)
    if args.score:
        import tempfile
        from independent_voltage_receipt import measure
        from locked_course import run_score
        with tempfile.TemporaryDirectory() as directory:
            packed=Path(directory)/"original.zip";packed.write_bytes(arc)
            a2=run_score(packed,ARCHIVE_SHA); b2=measure(packed,ARCHIVE_SHA)
        assert abs(check_score(a2,b2)-primary)<1e-13 and a2["joint"]==a["joint"]
        check_score(a2,b)
        check_score(a,b2)
    print(json.dumps(dict(archive_sha256=ARCHIVE_SHA,verified_forecast_arrays=len(raw),physical_training_phantoms=3,
        held_observations=1302,pattern_arm_rmse_crosschecks=462,joint=a["joint"],candidate_mean_rmse_mV=1000*primary,
        official_test_phantoms_read=0,ground_truth_images_read=0,live_numerical_recount=args.score),sort_keys=True))


if __name__=="__main__":
    main()
