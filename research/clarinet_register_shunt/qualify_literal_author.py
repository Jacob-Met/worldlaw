"""Compare the unchanged authored .m outputs against our source-bound evaluation."""
import hashlib,json,os,pathlib,shutil,subprocess,sys,tempfile
import numpy as np
from author_tube import channels
g=json.load(open("protocol.json"))["geometry"];root=pathlib.Path(sys.argv[1]).resolve()
reg=json.loads((root/"authored.json").read_text())
for r in reg:
    assert hashlib.sha256((root/r["name"]).read_bytes()).hexdigest()==r["sha"]
mfile="""g=jsondecode(fileread('geometry.json')); fid=fopen('actual.bin','wb','ieee-le'); for u=1:3, for l=1:7, p.L1=g.L1(1); p.x_pos=p.L1/(p.L1+g.L2(l)); p.Lh=.010; p.R=.0075; p.Rh=u/2000; p.freqsFitLosses=[1 5]; [zc,zo,f,fn]=impedance_tube_CstL1(p,44100); k=1001:2:40001; rc=(zc(k)-1)./(zc(k)+1); ro=(zo(k)-1)./(zo(k)+1); fwrite(fid,[real(rc);imag(rc);real(ro);imag(ro)],'double'); end; end; fclose(fid);"""
(root/"literal.m").write_text(mfile);(root/"geometry.json").write_text(json.dumps(g))
subprocess.run(["octave-cli","--no-gui","--quiet","literal.m"],cwd=root,check=True)
a=np.fromfile(root/"actual.bin",dtype="<f8").reshape(3,7,19501,4)
f=100+np.arange(19501)*.2
mx=0.;direct=0.
for u in range(1,4):
    for l in range(1,8):
        z=a[u-1,l-1];rc=z[:,0]+1j*z[:,1];ro=z[:,2]+1j*z[:,3];d,m=channels(f,g,u,l)
        direct=max(direct,float(np.max(abs(d-ro))));mx=max(mx,float(np.max(abs(m(rc)-ro))))
assert direct<2e-7 and mx<2e-7,(direct,mx)
print(json.dumps(dict(authentic_matlab_files=[r["sha"] for r in reg],all_combinations=21,all_native_frequencies=19501,max_direct_open_reflection_difference=direct,max_author_closed_to_open_difference=mx,measured_spectra_read=0)))
