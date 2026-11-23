"""Equal-input adapter to the unmodified published native Octave functions."""
import os,pathlib,json,subprocess
import numpy as np
def run_author(data, work, runtime):
    work=pathlib.Path(work);work.mkdir(exist_ok=True,parents=True)
    assert len(data)==3 and data[0].shape==data[1].shape==data[2].shape
    a,b,c=data
    pseudo=np.clip(a+c-b,0,1)
    M=np.empty_like(a)
    M[::2,::2]=c[::2,::2];M[::2,1::2]=b[::2,1::2]
    M[1::2,::2]=pseudo[1::2,::2];M[1::2,1::2]=a[1::2,1::2]
    M.astype('<f4').tofile(work/'mosaic.bin')
    o=json.loads(pathlib.Path(runtime).read_text()); env={**os.environ,**o['env'],'OPENBLAS_NUM_THREADS':'1','OMP_NUM_THREADS':'1'}
    pre=';'.join("addpath(genpath('%s'))"%p for p in o['image_paths']+[str(pathlib.Path(o['source'])/'Functions')])
    h,w=a.shape
    program=f"""{pre}; if isempty(which('imfilter')), pkg load image; end;
    fid=fopen('{work}/mosaic.bin','rb','ieee-le');M=fread(fid,[{w},{h}],'single=>double').';fclose(fid);
    [X,Y]=meshgrid(1:{w},1:{h});A=mod(X,2)==1 & mod(Y,2)==1;B=mod(X,2)==0 & mod(Y,2)==1;
    C=mod(X,2)==1 & mod(Y,2)==0;D=mod(X,2)==0 & mod(Y,2)==0; clear X Y;
    for method={{@EARI,@IGRI2}}
       [a,b,c,d]=method{{1}}(M,eps,double(D),double(B),double(A),double(C));assert(all(isfinite(d(:))));
       fd=fopen(['{work}/' func2str(method{{1}}) '.f32'],'wb','ieee-le');fwrite(fd,d.','single');fclose(fd);clear a b c d;
    end
    """
    script=work/'author.m';script.write_text(program)
    proc=subprocess.run([o['octave'],'--no-window-system','--norc','--quiet',str(script)],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    if proc.returncode:raise RuntimeError(proc.stdout[-2500:])
    return {k:np.fromfile(work/(k+'.f32'),dtype='<f4').reshape(h,w) for k in ('EARI','IGRI2')}
