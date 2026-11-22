"""Run the archived C firmware on training runs only; preserve rowwise raw observations."""
import array
import hashlib
import heapq
import json
from pathlib import Path
import struct
import subprocess
import sys
import zipfile

COMMIT = '8f57a3197515ece6c2d0ad93d3a6b64efabedf3c'
EXCLUDED = {19,45,52,67,60,62,74}
INPUTS = ['ambient','coolant','u_d','u_q','motor_speed','i_d','i_q']
CSV_SHA = '78f3d150f0f2ad9c5dc7ff24dd12c00d386ad530f48c1589ad24fcd88867d3ad'


def compile_firmware(out):
    repo = out/'firmware-checkout'
    subprocess.run(['git','init','-q',repo],check=True)
    subprocess.run(['git','-C',repo,'fetch','-q','--depth','1','https://github.com/pavanyadava007/motor-temp-edge.git',COMMIT],check=True)
    subprocess.run(['git','-C',repo,'checkout','-q','--detach','FETCH_HEAD'],check=True)
    assert subprocess.check_output(['git','-C',repo,'rev-parse','HEAD'],text=True).strip()==COMMIT
    # Use the distributor's complete host compile recipe and frozen tracked weights.
    compiler=['gcc','-std=c99','-O2','-Wall','-Wextra','-Werror','-ffp-contract=off','-fno-math-errno','-Ifirmware/include','-Ifirmware/generated','firmware/src/mte_ewma.c','firmware/src/mte_mlp.c','firmware/src/pil_main.c','firmware/host/io_stdio.c','firmware/host/main_host.c','-o',str(out/'mte_host')]
    subprocess.run(compiler,cwd=repo,check=True)
    return {p:hashlib.sha256((repo/p).read_bytes()).hexdigest() for p in ['firmware/generated/mte_model_data.h','firmware/src/mte_ewma.c','firmware/src/mte_mlp.c','firmware/src/pil_main.c']}


def main(base,out):
    assert sys.byteorder=='little'
    out.mkdir(exist_ok=True,parents=True)
    hashes=compile_firmware(out)
    runs=[]
    with zipfile.ZipFile(base/'publisher.zip') as z, z.open('measures_v2.csv') as f,(out/'train-input.f32').open('wb') as inputs,(out/'train-target.f64').open('wb') as targets:
        h=hashlib.sha256()
        header=f.readline()
        h.update(header)
        col=header.decode().strip().split(',')
        idx=[col.index(k) for k in INPUTS]
        last=None
        for raw in f:
            h.update(raw)
            parts=raw.rstrip().split(b',')
            pid=int(parts[col.index('profile_id')])
            if pid in EXCLUDED:
                continue
            start=pid!=last
            if start:
                runs.append([pid,0]);last=pid
            runs[-1][1]+=1
            inputs.write(struct.pack('<8f',float(start),*[float(parts[i]) for i in idx]))
            targets.write(struct.pack('<d',float(parts[col.index('pm')])))
    assert h.hexdigest()==CSV_SHA and len(runs)==62 and sum(n for _,n in runs)==1224499
    subprocess.run([out/'mte_host',out/'train-input.f32',out/'train-output.f32',out/'train-features.f32'],check=True)
    report={'runs':runs,'source_hashes':hashes,'profile_results':{},'worst_training_records':[]}
    worst=[]
    with (out/'train-target.f64').open('rb') as truth,(out/'train-input.f32').open('rb') as features,(out/'train-output.f32').open('rb') as pred:
        for pid,n in runs:
            errors=[[],[]]
            for j in range(n):
                y,=struct.unpack('<d',truth.read(8))
                x=struct.unpack('<8f',features.read(32))
                z=struct.unpack('<4f',pred.read(16))
                for i,k in enumerate([0,2]):errors[i].append(abs(z[k]-y))
                item=(errors[0][-1],pid,j,y,z[0],z[2],x)
                heapq.heappush(worst,item)
                if len(worst)>25:heapq.heappop(worst)
            report['profile_results'][pid]=[[sum(e**2 for e in a)/n,sum(a)/n,max(a)] for a in errors]
        assert not truth.read(1) and not features.read(1) and not pred.read(1)
    report['worst_training_records']=sorted(worst,reverse=True)
    report['array_hashes']={}
    for name in ['train-input.f32','train-target.f64','train-output.f32','train-features.f32']:
        with (out/name).open('rb') as f:report['array_hashes'][name]=hashlib.file_digest(f,'sha256').hexdigest()
    (out/'train-receipt.json').write_text(json.dumps(report,indent=2)+'\n')
    bad=sorted(report['profile_results'].items(),key=lambda it:it[1][0][0],reverse=True)[:6]
    print('TRAIN_COMPLETE',out,json.dumps({'worst':report['worst_training_records'][:5],'profiles':bad,'hashes':report['array_hashes'],'weights':hashes}),flush=True)

if __name__=='__main__':main(Path(sys.argv[1]),Path(sys.argv[2]))
