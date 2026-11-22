"""Authenticate the two public releases and match acquisition metadata without response labels."""

import collections
import hashlib
from pathlib import Path
import re
import struct
import zipfile
import h5py

RAW_MD5 = "e671b804e29401e70043bc1e17f66dd1"
TRAIN_MD5 = "b031a047c61bfd14ddd294a63afc94ac"


def authenticate(path, size, digest):
    with Path(path).open("rb") as src:
        measured = hashlib.file_digest(src, "md5").hexdigest()
    if Path(path).stat().st_size != size or measured != digest:
        raise ValueError(f"Unexpected source bytes for {path}")


def raw_roster(archive):
    authenticate(archive, 1248078255, RAW_MD5)
    matcher = re.compile(r"global_3d_dic/Nodemaps/global_3d_dic_results_1_(\d+)\.txt")
    with zipfile.ZipFile(archive) as z:
        names = set(z.namelist())
        nodemaps = {int(m[1]): name for name in names if (m := matcher.fullmatch(name))}
        expected = {
            f"global_3d_dic/Connections/global_3d_dic_results_1_{s}_connections.txt"
            for s in nodemaps
        }
        actual = {
            n for n in names if n.startswith("global_3d_dic/Connections/") and n.endswith(".txt")
        }
        assert len(names) == 714 and len(nodemaps) == 342 and actual == expected
        stages = []
        for s, name in sorted(nodemaps.items()):
            measurements = {}
            with z.open(name) as f:
                for row in f:
                    if not row.startswith(b"#"):
                        break
                    key, sep, val = row[1:].partition(b":")
                    key = key.strip().decode("ascii", errors="replace")
                    if not sep or key not in (
                        "current_stage_index",
                        "reference_stage_index",
                        "force",
                        "cycles",
                        "time",
                    ):
                        continue
                    part = val.decode().strip().split(":")
                    if len(part) == 2:
                        assert part[0].strip() == "value_element"
                    measurements[key] = float(part[-1])
            assert (
                measurements["current_stage_index"] == s
                and measurements["reference_stage_index"] == 1
            )
            stages.append((s, measurements["force"], measurements["cycles"], measurements["time"]))
    grouped = collections.defaultdict(list)
    for s, f, c, t in stages:
        grouped[c].append([s, f, t])
    groups = []
    for c, rows in sorted(grouped.items()):
        selected = []
        for low, high in ((4400, 4600), (9650, 9850), (14900, 15100)):
            hit = [r for r in rows if low <= r[1] <= high]
            if len(hit) != 1:
                break
            selected.append(hit[0])
        if len(selected) == 3 and selected[0][2] < selected[1][2] < selected[2][2]:
            groups.append(dict(cycle=c, low=selected[0], mid=selected[1], high=selected[2]))
    assert len(groups) == len(grouped) == 114 and all(len(v) == 3 for v in grouped.values())
    return stages, groups


def load_crosswalk(training, stages):
    authenticate(training, 405366635, TRAIN_MD5)
    f32 = lambda f: struct.unpack("<f", struct.pack("<f", f))[0]
    raw = collections.Counter(f32(f) for _, f, _, _ in stages)
    out = {}
    with h5py.File(training, "r") as h:
        names = h["experiments"].asstr()[...].tolist()
        ids = h["train_exp_ids"][...]
        forces = h["train_forces"][..., 0]
        assert forces.dtype.str == "<f4" and ids.shape == forces.shape
        for side in ("left", "right"):
            selected = forces[ids == names.index("MT160_2024_LT_2_" + side)]
            counts = collections.Counter(float(f) for f in selected)
            hits = set(raw) & counts.keys()
            clean = {f for f in hits if raw[f] == 1 and counts[f] == 8}
            seen = collections.Counter(c for _, f, c, _ in stages if f32(f) in clean)
            out[side] = {
                "training_rows": len(selected),
                "different_loads": len(counts),
                "exact_match_loads": len(hits),
                "matched_rows": sum(counts[f] for f in hits),
                "unique_stage_eight_augmentations": len(clean),
                "matched_stages": [s for s, f, _, _ in stages if f32(f) in clean],
                "counter_histogram": {
                    str(k): sum(seen[c] == k for c in {v[2] for v in stages}) for k in range(4)
                },
            }
    return out


def check_training_witness(archive, expected):
    """Independently join the worst training pair by ASCII ID and its active native triangles."""
    with zipfile.ZipFile(archive) as z:
        for record in expected:
            stage = record["stage"]
            node = record["id"]
            mesh_base = f"global_3d_dic_results_1_{stage}"
            with z.open(f"global_3d_dic/Nodemaps/{mesh_base}.txt") as source:
                matched = 0
                for raw in source:
                    if raw.startswith(b"#") or b";" not in raw:
                        continue
                    parts = raw.split(b";", 7)
                    if int(parts[0]) == node:
                        assert hashlib.sha256(raw).hexdigest() == record["line_sha256"]
                        assert [float(t) for t in parts[1:4]] == record["xyz"]
                        assert [float(t) for t in parts[4:7]] == record["uvw"]
                        matched += 1
                assert matched == 1
            triangles = []
            with z.open(f"global_3d_dic/Connections/{mesh_base}_connections.txt") as f:
                f.readline()
                for row in f:
                    kind, number, *vertices = map(int, row.split(b";"))
                    if vertices[0] != -1 and node - 1 in vertices:
                        assert kind == 3
                        triangles.append(number)
            assert triangles == record["active_triangle_ids"]
