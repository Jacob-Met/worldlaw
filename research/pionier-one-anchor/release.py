"""Read narrowly defined columns in the authenticated Halbwachs et al. source release."""
import hashlib
import math
from pathlib import Path
import re
import tarfile
import urllib.request

SHA = "182cc7b0c35d21ae628e2ca7b645b8d7870ad708ad8d12e51e19a7c431a68439"
SIZE = 50407
STARS = ("14157", "20601", "117186")

def source(path):
    path = Path(path)
    if not path.exists():
        with urllib.request.urlopen("https://arxiv.org/src/1510.07412", timeout=45) as stream:
            raw = stream.read(SIZE + 1)
        if hashlib.sha256(raw).hexdigest() != SHA:
            raise ValueError("Unexpected release download")
        path.write_bytes(raw)
    raw = path.read_bytes()
    if len(raw) != SIZE or hashlib.sha256(raw).hexdigest() != SHA:
        raise ValueError("Source archive identity")
    with tarfile.open(path) as archive:
        text = archive.extractfile("MN-PIO.tex").read().decode("latin1")
    tables = {}
    for match in re.finditer(r"\\begin\{table\*?\}([\s\S]*?)\\end\{table\*?\}", text):
        body = match.group(1)
        label = re.search(r"\\label\{([^{}]*)\}", body).group(1)
        tables[label] = body
    return tables

def numbers(cell):
    return [float(value) for value in re.findall(r"[-+]?(?:\d+\.\d*|\d+)",cell)]

def projected_tables(path, targets=False):
    tables = source(path)
    stars = {}
    rows = tables["tab:orbSB2"].splitlines()
    for i,line in enumerate(rows):
        star = line.split("&")[0].strip()
        if star not in STARS:
            continue
        v,se,v2,se2 = [row.split("&") for row in rows[i:i+4]]
        fields = {}
        for name,j in (("period",1),("epoch",2),("e",3),("v0",4),("omega",5),("K1",6),("a1",8)):
            fields[name],fields[name+"_se"] = numbers(v[j])[0],numbers(se[j])[0]
        for name,j in (("K2",6),("a2",8)):
            fields[name],fields[name+"_se"] = numbers(v2[j])[0],numbers(se2[j])[0]
        stars[star] = fields
    line = next(row for row in tables["tab:HIP2"].splitlines() if row.lstrip().startswith(r"$\varpi_{SS}$"))
    for star,cell in zip(STARS,line.split("&")[1:]):
        stars[star]["parallax"],stars[star]["parallax_se"] = numbers(cell)
        stars[star]["epochs"] = []
    current = None
    for line in tables["tab:mesPIO"].splitlines():
        group = re.search(r"\{HIP\s+(\d+)\}",line)
        if group:
            current = group.group(1)
        if not re.match(r"^\s*\d{5}\.\d+\s*&",line):
            continue
        cells = line.split("&")
        epochs = stars[current]["epochs"]
        row = {"mjd":float(cells[0]),"fixed_flux":"*" in cells[1]}
        if not epochs or targets:
            row.update(rho=float(cells[2]),pa=float(cells[3]))
        epochs.append(row)
    if tuple(stars) != STARS or [len(stars[s]["epochs"]) for s in STARS] != [10,6,7]:
        raise ValueError("Three-star roster")
    if [stars[s]["epochs"][0]["mjd"] for s in STARS] != [56938.290,56938.367,56937.179]:
        raise ValueError("Earliest anchor identity")
    if any(not all(a["mjd"] < b["mjd"] for a,b in zip(stars[s]["epochs"],stars[s]["epochs"][1:])) for s in STARS):
        raise ValueError("Chronological order")
    return stars
