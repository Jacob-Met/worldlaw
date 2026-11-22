"""Exact spin–lift scaling counterexample, with optional authentic CasADi replay."""
import argparse
from fractions import Fraction as F
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "source_manifest.json").read_text())


def exact():
    vx, vz, radius = F(4), F("-1.2"), F(".02")
    mu, restitution = F(".3"), F(".85")
    fixed_lift = F(".00000486")
    rows = []
    for scale in (1, 2):
        lift, spin_y = fixed_lift * scale, F(180, scale)
        slip = vx - radius * spin_y
        alpha = mu * (1 + restitution) * abs(vz) / abs(slip)
        rolling = alpha > F(".4")
        beta = F(".4") if rolling else alpha
        rows.append({"lift": lift, "spin_y": spin_y, "lift_spin": lift * spin_y,
                     "slip_x": slip, "alpha": alpha, "rolling": rolling,
                     "post_vx": vx - beta * slip, "post_vz": -restitution * vz})
    assert rows[0]["lift_spin"] == rows[1]["lift_spin"]
    assert rows[0]["rolling"] and not rows[1]["rolling"]
    assert rows[0]["post_vx"] - rows[1]["post_vx"] == F(253, 500)
    return rows


def load_source(name, directory):
    path = f"tt3d/rally/{name}.py"
    pin = MANIFEST["files"][path]
    url = f"https://raw.githubusercontent.com/{MANIFEST['repository']}/{MANIFEST['commit']}/{path}"
    with urlopen(url, timeout=90) as response:
        blob = response.read(pin["bytes"] + 1)
    assert len(blob) == pin["bytes"]
    assert hashlib.sha1(b"blob " + str(len(blob)).encode() + b"\0" + blob).hexdigest() == pin["git_blob"]
    target = directory / f"{name}.py"
    target.write_bytes(blob)
    spec = importlib.util.spec_from_file_location(name, target)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def authentic(rows):
    import casadi as ca
    import numpy as np

    with tempfile.TemporaryDirectory() as temp:
        source = Path(temp)
        load_source("constants", source)
        author = load_source("casadi_dae", source)
        p, v = ca.DM.zeros(3), ca.DM([4, 0, -1.2])
        recorded = []
        for row in rows:
            author.KM = float(row["lift"])
            w = ca.DM([0, float(row["spin_y"]), 0])
            post_v, post_w = author.bounce_model(v, w)
            assert abs(float(author.get_alpha(v, w)) - float(row["alpha"])) < 1e-12
            assert np.allclose(post_v.full().ravel(), [float(row["post_vx"]), 0, float(row["post_vz"])],
                               rtol=0, atol=1e-12)
            probes = [author.ball_dynamics(p, ca.DM(q), w)[1].full().ravel().tolist()
                      for q in ([4, 0, -1.2], [0, 1, -1], [1, 0, 0], [2, -.5, 1], [0, 0, 0], [4, -3, -2])]
            recorded.append({"probe_acceleration": probes, "post_v": post_v.full().ravel().tolist(),
                             "post_w": post_w.full().ravel().tolist()})
    assert recorded[0]["probe_acceleration"] == recorded[1]["probe_acceleration"]
    print(json.dumps({"casadi": ca.__version__, "numpy": np.__version__, "responses": recorded}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--author", action="store_true", help="Run the two content-pinned author modules with CasADi")
    args = parser.parse_args()
    rows = exact()
    print(json.dumps(rows, default=str, indent=2))
    if args.author:
        authentic(rows)
