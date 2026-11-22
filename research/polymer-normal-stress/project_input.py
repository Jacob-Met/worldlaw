"""Project only measured viscosities and oscillatory moduli from spatially separated NIST columns."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

PAGES = {2490: 71, 2491: 66}
DIGEST = {2490:"cd9be21769bf7174cb9f651cc503c5a1c7ac0201a863e3f33d5c9b12e8a9f2a6",
          2491:"df923ee46cc8d427df152c35e04956426c2ad9ea4198e808fa84ce63da489726"}


def read_page(path, i):
    return subprocess.check_output(["pdftotext", "-layout", "-f", str(i), "-l", str(i),
                                    str(path), "-"]).decode().splitlines()


def project(root):
    result = {}
    for mat, start in PAGES.items():
        path = root / f"{mat}-primary.pdf"
        assert hashlib.sha256(path.read_bytes()).hexdigest() == DIGEST[mat]
        data = {"steady":{}, "dynamic":{}, "unresolved":[]}
        for j, temp in enumerate([0,25,50,0,10,20,30,40,50]):
            page = j + start
            ls = read_page(path, page)
            rows = []
            for row, line in enumerate(ls):
                fs = line.split()
                # Three text-layer defects were verified on isolated raster crops.
                if mat == 2490 and page in (77,79) and fs[:1] == ["6.310"] and len(fs) == 7:
                    fs.insert(0, str(temp) + ".0")
                if mat == 2490 and page == 72 and fs[:4] == ["25.0","100.0","7","22"]:
                    fs[2:4] = ["7.22"]
                if len(fs) < 3 or not re.match(r"^[0-9]+[.]0$",fs[0]):
                    continue
                if float(fs[0]) != temp:
                    data["unresolved"].append([page,row,"temperature disagreement"])
                    continue
                if j < 3:
                    # Only rate and viscosity are decoded. Coordinates/asterisks in
                    # the remaining columns establish reporting eligibility without values.
                    try:
                        fields = [float(fs[k].strip("*")) for k in [1,2]]
                    except ValueError:
                        data["unresolved"].append([page,row,"steady input parse",fs[:3]])
                        continue
                    rows.append([*fields, [(x.start(),x.end(),"*" in x.group()) for x in re.finditer(r"\S+",line)]])
                else:
                    try:
                        fields = [float(fs[k].strip("*")) for k in [1,2,5]]
                    except (ValueError,IndexError):
                        data["unresolved"].append([page,row,"dynamic input parse",fs])
                        continue
                    rows.append(fields)
                    if len(fs)!=8:
                        data["unresolved"].append([page,row,"dynamic unusual columns",fs])
            if j < 3:
                data["steady"][str(temp)] = rows
            else:
                data["dynamic"][str(temp)] = rows
        result[str(mat)] = data
    return result


if __name__ == "__main__":
    print("INPUT_PROJECTION " + json.dumps(project(Path(sys.argv[1])), separators=(",",":")))
