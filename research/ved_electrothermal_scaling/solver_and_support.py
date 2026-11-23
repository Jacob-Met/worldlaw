"""Audit the released Fig 3 model code and exact matched-product support; no MAT reads."""
import hashlib
import io
import json
import zipfile
from pathlib import Path
from source_lattice import req

def main():
    roster = json.loads(Path("matched_commands.json").read_text())
    triads = roster["triads"]
    assert len(triads) == 21
    assert len({row["crc"] for group in triads for row in group}) == 63
    for step,(low,middle,high) in enumerate(triads):
        assert [r["bias"] for r in (low,middle,high)] == [100,200,400]
        assert high["step"] == step
        assert len({r["bias"]*r["step"] for r in (low,middle,high)}) == 1
    print("SUPPORT",len(triads),63,flush=True)
    with req("code_availibity.zip") as response:
        body=response.read(65537)
    assert hashlib.md5(body).hexdigest()=="12d86fa4446b941a2f72e5863d134f00"
    with zipfile.ZipFile(io.BytesIO(body)) as src:
        for item in src.infolist():
            if item.filename.endswith(".m") and "__MACOSX" not in item.filename:
                raw=src.read(item)
                print("AUTHOR",json.dumps([item.filename,hashlib.sha256(raw).hexdigest(),raw.decode("utf-8-sig")]),flush=True)

if __name__=="__main__":
    main()
