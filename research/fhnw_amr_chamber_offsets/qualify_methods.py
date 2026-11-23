"""Authenticate public method text and identify the provenance of the literal plotting anchor."""
import hashlib,json,re
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request,urlopen

ROOT=Path(__file__).resolve().parent
BASE="https://zenodo.org/records/24110229/files/"
def fetch(name,roster):
    u=BASE+quote(name,safe="/")+"?download=1"
    with urlopen(Request(u,headers={"User-Agent":"Public AMR physical metrology reader"}),timeout=45) as f:raw=f.read()
    if hashlib.md5(raw).hexdigest()!=roster[name]:raise ValueError(("archive MD5",name))
    return raw

def main():
    r=json.loads((ROOT/"source_roster.json").read_text())
    assert len(r)==89 and sum("/DC_field_" in k for k in r)==63
    names=[k for k in r if k in ("README.md","LICENSE.md") or k.endswith(".py") or k.endswith(".m")]
    methods=[]
    for name in names:
        raw=fetch(name,r);s=raw.decode("utf-8-sig")
        # Return only occurrences of this published fixed literal, with all other numbers hidden.
        hits=[]
        for i,line in enumerate(s.splitlines(),1):
            if "0.9921" in line:
                hits.append([i,re.sub(r"[0-9]+(?:\.[0-9]+)?",lambda m:"0.9921" if m.group()=="0.9921" else "#",line.strip())])
        methods.append(dict(name=name,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),anchor_lines=hits))
    print(json.dumps(dict(record=24110229,roster=len(r),dc_files=63,method_files=methods,opened_measurement_tables=0,held_chamber_rows=0),sort_keys=True))
if __name__=="__main__":main()
