"""Authenticate the original forecasts and observations, then reconstruct the prospective comparison."""
import hashlib,json,os,subprocess,sys,tempfile,zlib
from pathlib import Path
import numpy as np
from independent import verify
HERE=Path(__file__).resolve().parent
EXPECTED={"bank.json":"fff81752e7684f4c1d3b27036e367448a2e7ac5ab70118d2bb880e1198b6037d","outcome.json":"483c9fdb75f50c9628246b08545b903d7eb9b0fec6f67d4e9706ae5860bc7f80"}
def run():
    env=dict(os.environ,OPENBLAS_NUM_THREADS="1",OMP_NUM_THREADS="1",PYTHONDONTWRITEBYTECODE="1")
    with tempfile.TemporaryDirectory() as td:
        d=Path(td)
        for n,sha in EXPECTED.items():
            data=zlib.decompress((HERE/(n+".zlib")).read_bytes())
            assert hashlib.sha256(data).hexdigest()==sha
            (d/n).write_bytes(data)
        verify(d/"bank.json",d/"outcome.json")
        for args in [("forecast","newbank.json"),("score","newscore.json","--bank","newbank.json")]:
            subprocess.run([sys.executable,str(HERE/"shape_transfer.py"),*args],cwd=d,env=env,check=True)
        old=json.loads((d/"bank.json").read_text());new=json.loads((d/"newbank.json").read_text());errors=[]
        for l,a in old["assignments"].items():
            b=new["assignments"][l]
            assert a["selected"]==b["selected"] and a["x"]==b["x"] and a["R"]==b["R"] and set(a["V"])==set(b["V"])
            for k,v in a["V"].items():
                errors.append(float(np.max(np.abs(np.array(v)-b["V"][k]))))
                assert np.allclose(v,b["V"][k],rtol=2e-7,atol=2e-8)
        prior=json.loads((d/"outcome.json").read_text());now=json.loads((d/"newscore.json").read_text())
        for l,a in prior["assignments"].items():
            b=now["assignments"][l];assert a["gate"]==b["gate"]
            for k,q in a["scores"].items():
                for field in ("global_loss","worst_bin","bins","gain","residual"):
                    assert np.allclose(q[field],b["scores"][k][field],rtol=2e-7,atol=2e-8)
        assert prior["joint"]==now["joint"]==False
        print("REPLAY maximum forecast difference",max(errors),"original bank exact",hashlib.sha256((d/"newbank.json").read_bytes()).hexdigest()==EXPECTED["bank.json"])
if __name__=="__main__":run()
