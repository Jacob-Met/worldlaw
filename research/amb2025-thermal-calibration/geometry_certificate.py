"""Receive only the organizer's prechallenge IN718 description and calibration Table 5."""
from decimal import Decimal as D
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path

URL = "https://www.nist.gov/system/files/documents/2025/12/18/AMB2024-06%20and%2007%20challenge%20descriptions_v3.pdf"
EXPECTED = [
    ("135.4","124.2"),("138.0","125.8"),("137.4","125.9"),
    ("137.8","122.9"),("140.6","124.9"),("137.6","126.7"),
]
def main():
    root=Path(tempfile.mkdtemp(prefix="p3-f747-nist-amb-2025-design-"))
    with urllib.request.urlopen(URL,timeout=50) as reply:
        data=reply.read(16_000_001)
    assert data.startswith(b"%PDF") and len(data)<=16_000_000
    path=root/"organizer-design.pdf";path.write_bytes(data)
    proc=subprocess.run(["pdftotext","-layout",str(path),"-"],capture_output=True,check=True)
    text=proc.stdout.decode("utf8")
    begin=text.index("Table 5. Single track, cross-sectional")
    section=text[begin:begin+7500]
    rows=[]
    for line in section.splitlines():
        fields=line.split()
        if len(fields)==10 and fields[0].isdecimal() and 1<=int(fields[0])<=6:
            rows.append([fields[1],fields[4]])
    assert rows==[list(t) for t in EXPECTED],rows
    assert re.search(r"Average\s+137\.8\s+135\.5\s+10\.4\s+125\.1",section)
    assert re.search(r"5\.9\s+13\.7\s+1\.7\s+12\.6",section)
    summary=[]
    for i,(wt,dt) in enumerate(rows):
        w,d=D(wt),D(dt)
        summary.append({"section":i+1,"width_um":wt,"depth_um":dt,"two_depth_minus_width_um":str(2*d-w),
                        "anisotropic_ratio_min":float((2*d/w)**2)})
    upper_w=D("137.8")+D("5.9");lower_d=D("125.1")-D("12.6")
    out={"url":URL,"source_sha256":hashlib.sha256(data).hexdigest(),"source_bytes":len(data),"sections":summary,
         "upper_width_um":str(upper_w),"two_lower_depth_um":str(2*lower_d),
         "interval_gap_um":str(2*lower_d-upper_w),"effective_ratio_min_at_extremes":float((2*lower_d/upper_w)**2),
         "ideal_model":"isotropic homogeneous constant-property half-space, insulated free surface except nonnegative straight-line circular Gaussian flux, identical temperature isotherm, flat original reference plane",
         "held_pad_measurements_read":0}
    (root/"geometry-certificate.json").write_text(json.dumps(out,sort_keys=True))
    print(json.dumps({"root":str(root),**out},sort_keys=True))
if __name__=="__main__":main()
