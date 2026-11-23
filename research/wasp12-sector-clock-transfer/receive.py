"""Read Wong et al. Table A1 from the published text or its VizieR table."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from urllib.request import urlopen
from fit import table, WONGCAT

PDF = "https://ntrs.nasa.gov/api/citations/20220009055/downloads/Wong.tess.STI.pdf"

def acquire():
    try:
        r = table(WONGCAT, ["Name", "BJD", "e_BJD"])
        assert len(r) == 74
        source = {"provider":"VizieR","table":WONGCAT}
    except Exception as exc:
        print("VIZIER_RECEIVER_REFUSAL",type(exc).__name__,str(exc)[:150],flush=True)
        pdf = urlopen(PDF,timeout=100).read()
        Path("wong.pdf").write_bytes(pdf)
        subprocess.run(["pdftotext","-layout","wong.pdf","wong.txt"],check=True)
        data=Path("wong.txt").read_text()
        # Anchor the reported individual visit, BJD and its printed uncertainty.
        pattern = re.compile(r"^\s*(S(?:20|43|44|45)[-−–]\d+)\s+(245\d{4}\.\d+)\s*(?:±|\+/-|\+-)\s*(0\.\d+)",re.M)
        r=[[n.replace("−","-").replace("–","-"),b,s] for n,b,s in pattern.findall(data)]
        if len(r)!=74:
            heads=[x[:100] for x in data.splitlines() if re.match(r"\s*S(?:20|43|44|45)[-−–]\d+\s+",x)]
            print("PUBLISHED_FORMAT",len(heads),heads[:1],flush=True)
            raise ValueError("expected 74 uniquely parsed published timing rows, observed "+str(len(r)))
        source={"provider":"NASA original Wong journal PDF","url":PDF,"sha256":hashlib.sha256(pdf).hexdigest(),"bytes":len(pdf)}
    assert len({n for n,_,_ in r})==len(r)==74
    assert all(re.fullmatch(r"S(?:20|43|44|45)-\d+",n) and 2400000<float(t)<2500000 and 0<float(s)<0.03 for n,t,s in r)
    print("ROWS",source,flush=True)
    return r,source
