"""Replay the exact continuum and irregular-grid certificates without scientific inputs."""
from fractions import Fraction as F
import hashlib
import itertools
import json
from pathlib import Path
import random
from intercept import WINDOWS, certificate
from sampling import finite_design
from verify import recount, solve


def check_irregular_designs():
    # Independent dual enumeration: extreme solutions of the absolute-weight LP use
    # at most three observations. All positive distinct triples here have full rank.
    rng = random.Random(3867)
    checked = 0
    worst = F(0)
    for _ in range(80):
        ns = sorted(F(i,50) for i in rng.sample(range(1,51), rng.randrange(3,10)))
        result = finite_design(ns)
        alternatives = []
        for a,b,c in itertools.combinations(ns,3):
            weights = solve([[F(1)]*3,[a*a,b*b,c*c],[a**3,b**3,c**3]],[F(1),F(0),F(0)])
            alternatives.append(sum(map(abs,weights)))
        gain = F(result["gain"])
        assert gain == min(alternatives)
        # Rescaling the pressure unit cannot change intercept information.
        assert finite_design([7*t for t in ns])["gain"] == str(gain)
        assert gain >= F(certificate(ns[0]/ns[-1])["free_compliance_gain"])
        checked += len(alternatives)
        worst = max(gain,worst)
    assert finite_design(["4/5","4/5","1"])["gain"] == "unbounded"
    assert finite_design(["0","4/5","1"])["gain"] == "1"
    return checked,worst


def main():
    root=Path(__file__).parent
    record=json.loads((root/"source.json").read_text())
    rule=record["frozen_rule"]
    assert rule["post"] == 184308 and rule["load_fraction_lower"] == "64/125"
    assert rule["curve_or_profile_arrays_opened"] == 0 and rule["individual_sites_scored"] == 0
    raw=(root/"certificate.json").read_bytes()
    digests=record["independent_certificate"]
    assert hashlib.sha256(raw).hexdigest() == digests["file_sha256"]
    frozen=json.loads(raw)
    assert [certificate(lower) for lower in WINDOWS] == frozen
    controls=[recount(rec) for rec in frozen]
    encoded=(json.dumps(controls,indent=2)+"\n").encode()
    assert hashlib.sha256(encoded).hexdigest() == digests["independent_output_sha256"]
    triples,worst=check_irregular_designs()
    print(json.dumps(dict(exact_gains=[v["gain"] for v in controls],
                          grid_noise_corners=sum(v["noise_corners"] for v in controls),
                          test_locations=sum(v["exact_grid_points"] for v in controls),
                          irregular_designs=80, enumerated_three_point_rules=triples,
                          largest_synthetic_grid_gain=str(worst),
                          empirical_indent_pairs_scored=0),indent=2))


if __name__ == "__main__":
    main()
