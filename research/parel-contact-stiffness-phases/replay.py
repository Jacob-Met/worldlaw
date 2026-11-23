"""Recount the seven published paired stiffness estimates using exact decimals."""

import argparse
from fractions import Fraction
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
from statistics import mean


HERE = Path(__file__).resolve().parent
IDS = ("R1", "R2", "R3", "S1", "S2", "S3", "S4")
PHASES = ("loading", "unloading", "mean")
FULL = Fraction(138, 169)
MIDPOINT = 3 * FULL / 4
HALF_GRID = Fraction(1, 2000)


class ArticleTables(HTMLParser):
    """Keep all text within a cell while preserving table boundaries."""

    def __init__(self):
        super().__init__()
        self.tables = []
        self.table = self.row = self.cell = None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            self.table = []
        elif tag == "tr" and self.table is not None:
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None:
            self.row.append(" ".join("".join(self.cell).split()))
            self.cell = None
        elif tag == "tr" and self.row is not None:
            self.table.append(self.row)
            self.row = None
        elif tag == "table" and self.table is not None:
            self.tables.append(self.table)
            self.table = None

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)


def check_article(path, records, evidence):
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != evidence["sha256"] or len(raw) != evidence["bytes"]:
        raise ValueError("Article bytes differ from the observed PMC snapshot")
    parser = ArticleTables()
    parser.feed(raw.decode("utf-8"))
    tables = {}
    for table in parser.tables:
        rows = [row for row in table if row and row[0] in (*IDS, "S5")]
        if rows:
            key = (len(rows), len(rows[0]))
            if key in ((14, 9), (8, 9), (7, 7)):
                if key in tables:
                    raise ValueError("Ambiguous source table")
                tables[key] = rows
    normal, tangent, ratios = (tables[k] for k in ((14, 9), (8, 9), (7, 7)))
    for i, row in enumerate(records):
        observed = tangent[i]
        assert (observed[0], observed[2], observed[4:6], observed[8]) == (
            row["interface"], row["pressure"], row["tangential"], row["retained_steps"])
        if row["interface"] in IDS:
            for phase, source in (("loading", normal[i]), ("unloading", normal[7+i])):
                assert (source[0], source[2], source[3:5]) == (
                    row["interface"], row["pressure"], row[phase])
            assert ratios[i][0] == row["interface"]
            for phase, j in (("mean", 1), ("loading", 3), ("unloading", 5)):
                assert ratios[i][j:j+2] == row["ratios"][phase]


def preference(lower, upper):
    if lower > 0:
        return "full"
    if upper < 0:
        return "half"
    return "unresolved"


def phase_inputs(row, phase):
    if phase == "mean":
        return tuple((Fraction(a) + Fraction(b))/2
                     for a, b in zip(row["loading"], row["unloading"]))
    return tuple(map(Fraction, row[phase]))


def recount(records, evidence):
    if tuple(row["interface"] for row in records) != (*IDS, "S5"):
        raise ValueError("Published interface roster differs")
    if "loading" in records[-1] or "unloading" in records[-1]:
        raise ValueError("S5 has no published normal stiffness")
    expected = evidence["diagnostic"]
    assert expected["steps"] == {row["interface"]: row["retained_steps"] for row in records}
    assert (Fraction(expected["r"]), Fraction(expected["cutoff"])) == (FULL, MIDPOINT)
    paired = records[:-1]
    assert tuple(row["specimen"] for row in paired) == ("R", "R", "R", "S123", "S123", "S123", "S4")
    owners = {row["interface"]: row["specimen"] for row in paired}
    phases = {}
    for phase in PHASES:
        weights = {}
        rows = {}
        for row in paired:
            name = row["interface"]
            n, dn = phase_inputs(row, phase)
            t, dt = map(Fraction, row["tangential"])
            v, dv = map(Fraction, row["ratios"][phase])
            assert n > dn > 0 and t > dt > 0
            low = (t-HALF_GRID) / (n+HALF_GRID)
            high = (t+HALF_GRID) / (n-HALF_GRID)
            nominal = preference(t-MIDPOINT*n, t-MIDPOINT*n)
            rows[name] = {
                "n": n, "dn": dn, "t": t, "dt": dt, "ratio": t/n, "ratio_published": v,
                "d_ratio_published": dv, "ratio_delta": t/n-v, "nominal": nominal,
                "component_box": preference(t-dt-MIDPOINT*(n+dn), t+dt-MIDPOINT*(n-dn)),
                "published_ratio_box": preference(v-dv-MIDPOINT, v+dv-MIDPOINT),
                "printed_intervals_overlap": v+HALF_GRID >= low and v-HALF_GRID <= high,
            }
            weights[name] = Fraction(1, sum(owner == owners[name] for owner in owners.values()))
        for name, row in rows.items():
            training = [k for k in rows if owners[k] != owners[name]]
            slope = (sum(weights[k]*rows[k]["n"]*rows[k]["t"] for k in training)
                     / sum(weights[k]*rows[k]["n"]**2 for k in training))
            constant = (sum(weights[k]*rows[k]["t"] for k in training)
                        / sum(weights[k] for k in training))
            forecasts = {"full": FULL*row["n"], "half": FULL*row["n"]/2,
                         "constant": constant, "lso_scale": slope*row["n"]}
            row.update(lso_slope=slope, forecasts=forecasts,
                       errors={method: value-row["t"] for method, value in forecasts.items()})
        grouped = {method: {owner: mean(abs(rows[k]["errors"][method]) for k in rows
                                        if owners[k] == owner) for owner in set(owners.values())}
                   for method in ("full", "half", "constant", "lso_scale")}
        counts = {key: {label: sum(row[key] == label for row in rows.values())
                        for label in {row[key] for row in rows.values()}}
                  for key in ("nominal", "component_box", "published_ratio_box")}
        phases[phase] = dict(rows=rows, group_mae=grouped, preference_counts=counts,
                             equal_group_mae={method: mean(scores.values()) for method, scores in grouped.items()})
    actual = json.loads(json.dumps(phases, default=str))
    if actual != expected["phases"]:
        raise ValueError("Published score, row or interval classification differs")
    switches = [name for name in IDS if actual["loading"]["rows"][name]["nominal"]
                != actual["unloading"]["rows"][name]["nominal"]]
    assert switches == expected["phase_switches"] and expected["missing_normal"] == "S5"
    return {phase: {k: float(Fraction(v)) for k, v in actual[phase]["equal_group_mae"].items()}
            for phase in PHASES}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--article-html", type=Path, help="verify an exact independently retained PMC page")
    args = parser.parse_args()
    if not __debug__:
        raise RuntimeError("Run with assertions enabled")
    records = json.loads((HERE/"source-data.json").read_text())["data"]
    evidence = json.loads((HERE/"results.json").read_text())
    if args.article_html:
        check_article(args.article_html, records, evidence["source_qualification"])
    print(json.dumps(recount(records, evidence), indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
