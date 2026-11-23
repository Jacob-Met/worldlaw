"""Authenticate the Hoffer source ZIP and expose named direction-specific acquisition metadata."""
import csv
import hashlib
import io
import json
from pathlib import Path,PurePosixPath
import urllib.request
import zipfile

URL="https://api.figshare.com/v2/articles/14897091/versions/1"
SHA="2db6f26e29a5d8967d133dee2fa109d58b67e1a28a068bd00fd1f04bd9e4e402"
MD5="62d3528b4ac51cfc338cc89d52d9ee00"
SIZE=780782293
MISSING="TransitionPathData/Hairpin 30R50T4 transitions/Raw Folding Transtions 30R50T4_0.dat"

def authenticated_archive(path):
    path=Path(path)
    md=hashlib.md5()
    sha=hashlib.sha256()
    size=0
    if not path.exists():
        with urllib.request.urlopen(URL,timeout=45) as server:
            record=json.load(server)
        f=record["files"][0]
        if f["id"]!=31495328 or f["size"]!=SIZE or f["computed_md5"]!=MD5:
            raise ValueError("Unexpected archive identity")
        with urllib.request.urlopen(f.get("downloadUrl") or f["download_url"],timeout=120) as server,path.open("xb") as target:
            while block:=server.read(1024*1024):
                target.write(block)
    with path.open("rb") as stream:
        while block:=stream.read(1024*1024):
            md.update(block)
            sha.update(block)
            size+=len(block)
    if (size,md.hexdigest(),sha.hexdigest())!=(SIZE,MD5,SHA):
        raise ValueError("Raw archive integrity")
    return zipfile.ZipFile(path)

def metadata(archive):
    files=set(archive.namelist());out=[]
    for path in sorted(files):
        p=PurePosixPath(path)
        if not p.name.startswith("Data Info "):
            continue
        group=p.parent.name
        direction="U" if "Unfolding" in p.name else "F"
        rows=csv.reader(archive.read(path).decode("latin1").splitlines(),delimiter="\t")
        header=next(rows)
        if len(header)!=5 or "FileNames" not in header[0]:
            raise ValueError(("Info schema",path))
        for row in rows:
            if not row:
                continue
            name,dt,lb,ub,n=row
            member=str(p.parent/name)
            out.append({"group":group,"direction":direction,"member":member,
                        "dt_us":float(dt)*1e6,"start_nm":float(lb),"end_nm":float(ub),
                        "declared":int(n),"present":member in files})
    if len(out)!=702 or [r["member"] for r in out if not r["present"]]!=[MISSING]:
        raise ValueError("Unmatched archived roster")
    return out

def blocks(data):
    header=None;body=[]
    for line in data.splitlines():
        if not line.strip():
            continue
        if b"Transition" in line:
            if header is not None:
                yield header,body
            header=line;body=[]
        else:
            if header is None:raise ValueError("Numeric row before trajectory header")
            body.append(line)
    if header is not None:
        yield header,body
