"""Leave one of the six layout blocks out and compare both displayed-panel directions."""
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image

FIGURE = "76341cde06a59ed550b66fcd1bcef7ff1e3dee2af869bb4a3a722309f9379aae"
ROLES = ("copy", "source_map", "condition_mode", "pooled_solvent", "solvent_map", "condition_neighbor")


def read_panels(path):
    if sha256(path.read_bytes()).hexdigest() != FIGURE:
        raise ValueError("unexpected Figure 1 raster")
    a = np.asarray(Image.open(path).convert("RGB"))
    if a.shape != (626, 1163, 3):
        raise ValueError("unexpected dimensions")
    panels = []
    for top in (46, 380):
        panel = {}
        for row in range(16):
            y = round(top + (row + 0.5) * 230 / 16)
            for col in range(24):
                x = round(136 + (col + 0.5) * 1016 / 24)
                rgb = tuple(a[y, x].tolist())
                if not (a[y-4:y+5, x-12:x+12] == rgb).all():
                    raise ValueError(f"nonuniform cell at {row},{col}")
                panel[(row // 8 * 3 + col // 8, row % 8, col % 8 // 4, col % 4)] = rgb
        panels.append(panel)
    return panels


def best(weights, source):
    if not weights:
        return source
    return min(weights, key=lambda t: (-weights[t], t != source, t))


def predictions(key, rgb, examples):
    _, cat, base, sol = key
    global_target = Counter(t for _, _, t in examples)
    source_counts = Counter(t for _, s, t in examples if s == rgb)
    source_probs = {t: v/sum(source_counts.values()) for t, v in source_counts.items()}
    source_map = best(source_counts, rgb)
    cond = Counter(t for k, _, t in examples if k[1:] == (cat, base, sol))
    solvent = Counter(t for k, _, t in examples if k[3] == sol)
    # P(t | source) * P(t | solvent) / P(t). All positive smoothing uses 1.
    base_weights = {t: (source_counts[t]+1) * (solvent[t]+1) / (global_target[t]+1)
                    for t in global_target}
    local = Counter(t for k,s,t in examples if s == rgb and k[3] == sol)
    local_weights = {t: local[t]+4*source_probs.get(t,0) for t in set(local)|set(source_probs)}
    # Same inputs for all roles. Fixed distance selects nearest observed color,
    # then smallest Hamming distance over the three treatment identities.
    distances = [(sum((a-b)**2 for a,b in zip(s,rgb)), sum(a!=b for a,b in zip(k[1:],key[1:])))
                 for k,s,_ in examples]
    nearest = min(distances)
    neighbor = Counter(t for (_,_,t),d in zip(examples,distances) if d == nearest)
    return dict(zip(ROLES, (rgb, source_map, best(cond,rgb), best(base_weights,rgb),
                            best(local_weights,rgb), best(neighbor,rgb))))


def main(path):
    a,b = read_panels(path)
    summary = {"metric":"exact 24-bit RGB equality; directions unlabelled","cases":[],
               "panel_rgb_cardinalities":[len(set(a.values())),len(set(b.values()))]}
    for source,target,direction in ((a,b,"top_to_bottom"),(b,a,"bottom_to_top")):
        for group in range(6):
            training = [(k,s,target[k]) for k,s in source.items() if k[0] != group]
            counts = Counter()
            correct_by_cell = []
            for key in sorted(k for k in source if k[0]==group):
                pred=predictions(key,source[key],training)
                successes={name:int(value==target[key]) for name,value in pred.items()}
                counts.update(successes)
                correct_by_cell.append([*key,source[key],target[key],successes])
            summary["cases"].append({"direction":direction,"block":group,"n":len(correct_by_cell),
                                     "correct":dict(counts),"cells":correct_by_cell})
    comparisons = []
    for axis,size in ((1,8),(2,2),(3,4)):
        for offset in range(size):
            per_group = [0]*6
            for key,rgb in a.items():
                other = list(key)
                other[axis] = (other[axis]+offset)%size
                per_group[key[0]] += rgb==b[tuple(other)]
            comparisons.append({"axis":axis,"offset":offset,"correct_by_group":per_group})
    summary["alignment"]=comparisons
    return summary


if __name__ == "__main__":
    result=main(Path(sys.argv[1]))
    Path(sys.argv[2]).write_text(json.dumps(result,separators=(",",":"))+"\n")
