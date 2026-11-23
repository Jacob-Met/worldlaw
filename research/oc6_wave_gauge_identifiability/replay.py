"""Reconstruct the five-gauge OC6 result from the public paper or its embedded image."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import tempfile

import numpy as np

import figure
import geometry
import interval_proof
import reflection
import uncertainty


HERE = Path(__file__).resolve().parent
PDF_SHA = "efbd30a6cf641ef57024f09ce6a989d28e196f0c04204b0366d6440beda238dd"


def compare(live, frozen, key="result"):
    if isinstance(frozen, dict):
        if set(live) != set(frozen):
            raise ValueError(f"Field roster changed at {key}")
        for label, value in frozen.items():
            compare(live[label], value, key+"."+label)
    elif isinstance(frozen,list):
        if len(live) != len(frozen):
            raise ValueError(f"Row count changed at {key}")
        for i,(a,b) in enumerate(zip(live,frozen)):
            compare(a,b,f"{key}[{i}]")
    elif isinstance(frozen,float):
        if not math.isclose(live,frozen,rel_tol=2e-10,abs_tol=5e-11):
            raise ValueError(f"Numeric mismatch at {key}: {live!r}, expected {frozen!r}")
    elif live != frozen:
        raise ValueError(f"Mismatch at {key}: {live!r}, expected {frozen!r}")


def from_paper(path, folder):
    import fitz
    if hashlib.sha256(path.read_bytes()).hexdigest() != PDF_SHA:
        raise ValueError("Wang source PDF hash changed")
    with fitz.open(path) as doc:
        page = doc[9]
        if "Fig. 7." not in page.get_text() or [item[0] for item in page.get_images()] != [234]:
            raise ValueError("Unexpected page or embedded image identity")
        data = doc.extract_image(234)["image"]
    out=folder/"figure7-original.jpeg"
    out.write_bytes(data)
    return out


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    inp=parser.add_mutually_exclusive_group(required=True)
    inp.add_argument("--paper",type=Path)
    inp.add_argument("--jpeg",type=Path)
    args=parser.parse_args()
    ev=json.loads((HERE/"observations.json").read_text())
    compare(geometry.compute(),ev["geometry"],"fifteen-layouts")
    reflection.self_check()
    with tempfile.TemporaryDirectory() as tmp:
        jpeg = from_paper(args.paper,Path(tmp)) if args.paper else args.jpeg
        graph = figure.extract(jpeg)
    y=np.array([complex(r["markers"]["real"]["ordinate_m"],r["markers"]["imag"]["ordinate_m"])
                for r in graph["stations"]])
    for label in ("design_x_m","graph_x_m"):
        x=[r[label]/geometry.SCALE+geometry.PIVOT for r in graph["stations"]]
        graph[label]=reflection.compatibility(x,y,(10.54,11.85),.001,.029)
    compare(graph,ev["graph"],"B4-source-figure")
    scenarios=[("ratios_only",(0,0,0,0)),("coordinate_rounding_plus_survey",(.0065,0,0,0)),
               ("all_printed_boxes",(.0065,.005,.025,0)),("primary_k_1p5",(.0065,.005,.025,.015))]
    out=[]
    for label, args_ in scenarios:
        item=uncertainty.bound(y,*args_)
        item["scenario"]=label
        out.append(item)
    graphic_budget=math.sqrt(2)*.06*9/(417-2)
    compare({"scenarios":out,"graphic_center_plus_axis_complex_radius_m":graphic_budget},
            ev["uncertainty"],"uncertainty")
    grid=uncertainty.parent_box_inventory(y,16)
    compare(grid,ev["subdivision"],"parent-subdivision")
    pixels=[(r["markers"]["real"]["pixel"][1],r["markers"]["imag"]["pixel"][1])
            for r in graph["stations"]]
    certificate=interval_proof.certify(pixels)
    if certificate["verified_cells"] != 256 or certificate["excluded_uniform_complex_error_m"] != .0024:
        raise ValueError("Incomplete interval cover")
    if certificate["excluded_uniform_complex_error_m"] <= graphic_budget:
        raise ValueError("Excluded amplitude does not exceed graphical envelope")
    print(json.dumps({"layouts":15,"fixed_phase_checks":480,"printed_stations":5,
                      "symbols":15,"largest_magnitude_crosscheck_m":max(
                          r["magnitude_discrepancy_m"] for r in graph["stations"]),
                      "nominal_lower_m":graph["design_x_m"]["required_complex_gauge_perturbation_lower_m"],
                      "subdivided_numeric_lower_m":grid["uniform_lower_m"],
                      "interval_cells_verified":certificate["verified_cells"],
                      "interval_excluded_uniform_error_m":certificate["excluded_uniform_complex_error_m"],
                      "minimum_interval_crossed_constraint_excess_m":certificate["minimum_cross_constraint_gap_m"],
                      "graphical_envelope_m":graphic_budget,
                      "raw_time_series_opened":0,"held_component_load_comparison":"unassessed"},
                     sort_keys=True,allow_nan=False))


if __name__=="__main__":
    main()
