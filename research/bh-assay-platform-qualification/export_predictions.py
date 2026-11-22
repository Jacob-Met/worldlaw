"""Export actual predicted RGB triplets using the unchanged registered forecaster."""
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import sys

from paired_figure import predictions, read_panels, ROLES


def export(path, original):
    panels = read_panels(path)
    published = json.loads(original.read_text())
    rows = []
    for arm, source in enumerate(panels):
        target = panels[1 - arm]
        for group in range(6):
            train = [(k, s, target[k]) for k, s in source.items() if k[0] != group]
            case = published["cases"][arm * 6 + group]
            for i,key in enumerate(sorted(k for k in source if k[0] == group)):
                pred = predictions(key, source[key], train)
                rec = case["cells"][i]
                assert list(key) == rec[:4]
                assert list(source[key]) == rec[4] and list(target[key]) == rec[5]
                assert {m:int(pred[m] == target[key]) for m in ROLES} == rec[6]
                rows.append([arm,*key,source[key],target[key],*[pred[m] for m in ROLES]])
    return {"header":["direction_0_top_to_bottom","block","catalyst","base","solvent",
                      "source_rgb","target_rgb",*ROLES],"rows":rows}


if __name__ == "__main__":
    predicted = export(Path(sys.argv[1]), Path(sys.argv[2]))
    raw = json.dumps(predicted,separators=(",",":")).encode()+b"\n"
    Path(sys.argv[3]).write_bytes(raw)
    print("rows",len(predicted["rows"]),"SHA256",sha256(raw).hexdigest())
    matches = Counter(tuple(row[5]) for row in predicted["rows"] if row[0] == 0 and row[5] == row[6])
    print("Top exact-matching RGB counts",matches.most_common(4),"unique",len(matches))
    print("Native first predicted row",predicted["rows"][0])
