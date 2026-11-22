"""Recount the frozen PV development course and optionally refit it from the laboratory workbook."""
import argparse
import hashlib
import itertools
import json
import math
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
RESULT_SHA = "b335f52521c35a924688d4b7a216f20a1bc10bda3119330e46db27b4422cf8f3"
WORKBOOK_SHA = "9083c1b90616b35e10fcf127e80d386f1bf37722f946476a090ed6ef35526bca"
FAMILY = {3: "Hanwha", 4: "Jinko", 5: "Canadian", 6: "Canadian", 8: "Hanwha"}
NAMEPLATE = {3: 280, 4: 260, 5: 275, 6: 270, 8: 300}
CORNERS = {(100, 15), (100, 75), (1000, 15), (1100, 75)}
ARMS = {"candidate", "adr8", "huld8", "huld7", "source_residual_mean", "stc_pvwatts",
        "stc_generic_huld", "nameplate_pvwatts", "nameplate_generic_huld"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_results():
    data = (HERE / "frozen-results.json").read_bytes()
    require(hashlib.sha256(data).hexdigest() == RESULT_SHA, "Frozen result identity differs")
    result = json.loads(data)
    require(result["input_sha256"] == WORKBOOK_SHA and result["held_response_rows"] == 0,
            "Unexpected source or split")
    require({r["module"] for r in result["rows"]} == set(FAMILY) and len(result["rows"]) == 5,
            "Development roster differs")
    for row in result["rows"]:
        queries, graded = set(row["queries"]), row["graded"]
        require(len(queries) == 8 and set(graded) == set(range(27)) - queries and len(graded) == 19,
                "Flash budget or evaluation indices differ")
        require(set(row["scores"]) == ARMS and row["family"] == FAMILY[row["module"]],
                "Arm or manufacturer roster differs")
        for name, score in row["scores"].items():
            forecasts = score["predicted_all_watts"]
            require(len(forecasts) == len(row["actual"]) == 27, "Forecast grid differs")
            errors = [(forecasts[i] - row["actual"][i]) / row["actual"][i] for i in graded]
            rms = math.sqrt(sum(e * e for e in errors) / len(errors))
            require(max(abs(a - b) for a, b in zip(errors, score["graded_relative_errors"])) < 1e-12
                    and len(score["graded_relative_errors"]) == 19 and abs(rms - score["rms"]) < 1e-12
                    and abs(max(map(abs, errors)) - score["worst_abs"]) < 1e-12,
                    f"Relative errors differ for {row['module']} / {name}")
    for name in ARMS:
        scores = [r["scores"][name] for r in result["rows"]]
        s = result["summary"][name]
        require(abs(sum(x["rms"] for x in scores) / 5 - s["equal_device_rms"]) < 1e-12
                and abs(max(x["worst_abs"] for x in scores) - s["worst_abs"]) < 1e-12,
                "Aggregation differs")
    strong = min(("huld8", "adr8"), key=lambda n: result["summary"][n]["equal_device_rms"])
    c, b = (result["summary"][n] for n in ("candidate", strong))
    gate = c["equal_device_rms"] < b["equal_device_rms"] and c["worst_abs"] <= b["worst_abs"]
    require(strong == result["stronger"] == "adr8" and gate is result["gate"] is False,
            "Frozen development verdict differs")
    return result


def read_training_workbook(path):
    import numpy as np
    require(hashlib.sha256(path.read_bytes()).hexdigest() == WORKBOOK_SHA, "Workbook identity differs")
    namespace = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    relation = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
    curves, design = {}, None
    with ZipFile(path) as archive:
        book = ElementTree.fromstring(archive.read("xl/workbook.xml"))
        rel = ElementTree.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        paths = {x.get("Id"): x.get("Target") for x in rel}
        for sheet in book.findall(".//" + namespace + "sheet"):
            module = int(sheet.get("name").split("-")[1][:3])
            if module not in FAMILY:
                continue
            part = paths[sheet.get(relation)].lstrip("/")
            xml = ElementTree.fromstring(archive.read(part if part.startswith("xl/") else "xl/" + part))
            matrix = []
            for row in xml.findall(".//" + namespace + "sheetData/" + namespace + "row"):
                number = int(row.get("r"))
                if not 6 <= number < 34:
                    continue
                cells = {c.get("r")[:-len(str(number))]: c.findtext(namespace + "v") for c in row}
                if all(cells.get(k) is not None for k in ("C", "B", "H")):
                    matrix.append([float(cells[k]) for k in ("C", "B", "H")])
            g, t, power = np.asarray(matrix).T
            require(len(power) == 27, "Unexpected matrix length")
            if design is not None:
                require(np.array_equal(g, design[0]) and np.array_equal(t, design[1]),
                        "Operating conditions differ")
            design, curves[module] = (g, t), power
    require(set(curves) == set(FAMILY), "Missing development module")
    return *design, curves


def refit(path, frozen):
    import numpy as np
    import pvlib
    from pvlib import pvarray, pvsystem

    require(pvlib.__version__ == "0.15.2", "Replay requires the frozen pvlib 0.15.2")
    g, t, power = read_training_workbook(path)
    log_g, temp = np.log(g / 1000), (t - 25) / 50
    x = np.column_stack((log_g, log_g**2, temp, temp*log_g, temp*log_g**2, temp**2))
    stc, = np.flatnonzero((g == 1000) & (t == 25))
    pool = [i for i in range(len(g)) if i != stc and (g[i], t[i]) not in CORNERS]
    choices = np.array(list(itertools.combinations(pool, 6)))
    require(len(choices) == 74613, "Design search census differs")
    first = [int(stc)] + choices[np.argmax(np.abs(np.linalg.det(x[choices])))].tolist()
    require(first == frozen["first"], "Design-only anchor selection differs")
    largest = 0.
    for row in frozen["rows"]:
        module = row["module"]
        sources = [i for i in power if FAMILY[i] != FAMILY[module]]
        require(set(sources) == set(row["train"]), "Manufacturer exclusion differs")
        counts = Counter(FAMILY[i] for i in sources)
        weights = np.array([1 / (len(counts) * counts[FAMILY[i]]) for i in sources])
        residuals = []
        for i in sources:
            eta = power[i] / (g / 1000 * power[i][stc])
            beta = np.linalg.solve(x[first[1:]], eta[first[1:]] - 1)
            residuals.append(eta - (1 + x @ beta))
        residuals = np.array(residuals)
        mean = np.average(residuals, axis=0, weights=weights)
        centered = residuals - mean
        variance = np.average(centered**2, axis=0, weights=weights)
        eligible = sorted(set(pool) - set(first))
        probe = max(eligible, key=lambda i: variance[i])
        require(probe == row["probe"], "Eighth condition differs")
        known = first + [probe]
        y = power[module]
        np.testing.assert_array_equal(y, row["actual"])
        p0 = y[stc]
        # Preserve the producer's binary64 arithmetic at the nonlinear ADR fit interface.
        eta = y / (p0 * g / 1000)
        linear = np.linalg.solve(x[first[1:]], eta[first[1:]] - 1)
        seven = 1 + x @ linear
        observed = eta[probe] - seven[probe]
        slopes = np.average(centered * centered[:, probe, None], axis=0, weights=weights) / variance[probe]
        adjusted = seven + mean + slopes * (observed - mean[probe])
        out_of_range = not (min(residuals[:, probe]) <= observed <= max(residuals[:, probe]))
        require(out_of_range == row["abstain"], "Residual-range flag differs")
        beta8 = np.linalg.lstsq(x[known], eta[known] - 1, rcond=None)[0]
        k = beta8 * p0 / np.array((1, 1, 50, 50, 50, 2500))
        adr = pvarray.fit_pvefficiency_adr(g[known], t[known], eta[known])
        predicted = {
            "candidate": adjusted * p0 * g / 1000,
            "source_residual_mean": (seven + mean) * p0 * g / 1000,
            "huld7": seven * p0 * g / 1000,
            "huld8": pvarray.huld(g, t, p0, k=k),
            "adr8": pvarray.pvefficiency_adr(g, t, **adr) * p0 * g / 1000,
            "stc_generic_huld": pvarray.huld(g, t, p0, cell_type="cSi"),
            "stc_pvwatts": pvsystem.pvwatts_dc(g, t, p0, -.004),
            "nameplate_generic_huld": pvarray.huld(g, t, NAMEPLATE[module], cell_type="cSi"),
            "nameplate_pvwatts": pvsystem.pvwatts_dc(g, t, NAMEPLATE[module], -.004),
        }
        for name, values in predicted.items():
            diff = float(np.max(np.abs(values - row["scores"][name]["predicted_all_watts"])))
            require(diff < 1e-8, f"Forecast differs at {module}/{name}: {diff} watts")
            largest = max(largest, diff)
    print(f"Verified 1,215 forecasts from the five development worksheets; max delta {largest:.3g} W")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", type=Path, help="Verify the official workbook and redo every fit")
    args = parser.parse_args()
    result = read_results()
    if args.workbook:
        refit(args.workbook, result)
    for name in sorted(ARMS):
        s = result["summary"][name]
        print(f"{name}: equal-device RMS {s['equal_device_rms']:.6%}, worst {s['worst_abs']:.6%}")
    print("Verified 855 unqueried-condition errors. Development gate failed.")
