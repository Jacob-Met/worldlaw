"""Synthetic only: test published VHGPR without any pushing trajectories."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
from urllib.request import Request, urlopen

SHA = "ced8e7b0063fee3a921e65c048f9df893e61a4ee"
FILES = {"covAR1.m":"a6ee5f98b429c00ffe14b8d2cd8b7a6f412b53f9","covConst.m":"aece02742a10178b0889ca04c767e4f2bba77fa7","covNoise.m":"f3f62237ef01cf16adca4c58eb0eba03d56fdf28","covProd.m":"eeb020ac6cee89c32ba0a72e3406cd11d93c8b5e","covSEardj.m":"9dc30927838ac3750e224f730d5d5ee352c2e3ee","covSEiso.m":"f52228c39ff1b47c556b118fa5a40259b70677aa","covSEisoj.m":"b8c3421642a34d7e4da99107ec2669e05e78fbf5","covSum.m":"57a335d7cec9c3ac093ef1ab1fdab7a816acff64","covZero.m":"da60d42fb48d8afaabe57ccd32c5b8ec5038357c","gpr.m":"0220f117384015f80b2941741b8f8f53a4195fc8","gpr_multi.m":"1b40fc3389a5fa35ee7d2cfa53852359ff7b03d3","gpr_multi_GPy.m":"a812c40d6da98221b156a82c292a304bf0f05d26","gpr_multi_sl.m":"ebc22a3ad77afb6c1c6b4bf2861880ff138b8cf9","minimize.m":"354d8b1a7f0d8bdbfaa81fb8c82b060df07b9eca","nlogprob_vhgpr.m":"c06fe6cf3d3e59e054ccee3debfc71618e362b46","sq_dist.m":"46deb7dfc80ed9a36d5fa8f0664cba6cfa7a003e","vhgpr.m":"866b7bc3295b8ca4ba6f4724f374c1d9942d27f2","vhgpr_ui.m":"0f5d246a8e8c6189c56f2299dbc59ffe3ec8141b"}
DISTRIBUTION = Path("/var/tmp/p3-f747-kat-octave-signed-debs-y1o45k78")
FIXTURE = """
x=(1:24)'/24;
X=[x,cos(7*x)];
y=sin(5*x)+(0.1+x/10).*cos(33*x);
Q=[0.15,cos(1.05); 0.48,cos(3.36); 0.77,cos(5.39)];
a=[0;0;0]; b=[1;-1;0.5];
[na,la,ma,va]=vhgpr_ui(X,y,Q,a);
[nb,lb,mb,vb]=vhgpr_ui(X,y,Q,b);
assert(all(isfinite(ma)) && all(isfinite(va)) && all(va>0));
assert(isequal(ma,mb) && isequal(va,vb));
assert(isfinite(na) && isfinite(nb) && isfinite(la) && isfinite(lb) && abs(la-lb)>1e-5);
printf('QUALIFIED %s\\n',jsonencode(struct('mean',ma,'variance',va,'nmse',[na,nb],'nlpd',[la,lb],'version',version)));
"""


def main():
    dst = Path(tempfile.mkdtemp(prefix="p3-f747-mcube-author-vhgpr-", dir="/var/tmp"))
    for filename, sha in FILES.items():
        url = f"https://raw.githubusercontent.com/IPL-UV/simpleR/{SHA}/VHGPR/{filename}"
        with urlopen(Request(url, headers={"User-Agent":"source-qualification"}), timeout=30) as stream:
            data = stream.read()
        assert hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest() == sha, filename
        (dst/filename).write_bytes(data)
    print("Verified", len(FILES), "original MATLAB sources at", SHA, flush=True)
    exes = [p for p in DISTRIBUTION.rglob("octave-cli") if p.is_file() and p.parent.name=="bin"]
    if len(exes) != 1:
        raise ValueError(f"Existing private runtime unavailable; matched {len(exes)} executables")
    exe = exes[0]
    prefix = exe.parent.parent
    libdirs = sorted({str(p.parent) for p in (prefix/"lib").rglob("*.so*") if p.is_file()})
    env = dict(os.environ, OCTAVE_HOME=str(prefix), OCTAVE_EXEC_HOME=str(prefix),
               LD_LIBRARY_PATH=":".join(libdirs), OPENBLAS_NUM_THREADS="1", OMP_NUM_THREADS="1",
               QT_QPA_PLATFORM="offscreen", OCTAVE_HISTFILE="/dev/null")
    (dst/"check.m").write_text(FIXTURE)
    q = subprocess.run([str(exe), "--no-init-file","--quiet","--no-gui","check.m"],
                       cwd=dst,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    print(q.stdout[-6500:],flush=True)
    q.check_returncode()
    if "QUALIFIED " not in q.stdout:
        raise ValueError("Expected model predictions missing")


if __name__ == "__main__":
    main()
