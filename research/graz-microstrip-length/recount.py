"""Independent stdlib raw-wave recount, using explicit scalar 2x2 right division."""
import argparse
import ast
import cmath
from hashlib import sha256
import io
import json
import math
from pathlib import Path
import struct
import zipfile

LENGTHS = ('line_50__1_0mm', 'line_50__6_5mm')
ARMS = ('covariance_weighted','equal_path','nominal_phase_empirical','archived_short1','archived_short2','maintained_short2')
def read_npy(raw, shape):
    assert raw[:6] == b'\x93NUMPY' and raw[6] == 1
    length = struct.unpack_from('<H', raw, 8)[0]
    header = ast.literal_eval(raw[10:10+length].decode('latin1').strip())
    assert header['shape'] == shape and header['descr'] == '<c16'
    data = [complex(x,y) for x,y in struct.iter_unpack('<dd',raw[10+length:])]
    assert len(data)==math.prod(shape)
    if header['fortran_order']:
        from itertools import product
        return [data[sum(j*math.prod(shape[:k]) for k,j in enumerate(ix))] for ix in product(*(range(n) for n in shape))]
    return data

def read_touchstone(raw, clock):
    options=None
    fields=[]
    for row in raw.decode('utf-8-sig').splitlines():
        line=row.partition('!')[0].strip()
        if not line: continue
        if line.startswith('#'):
            options=line[1:].lower().split()
        else: fields.extend(float(x) for x in line.split())
    assert options[0] in ('hz','khz','mhz','ghz') and options[1]=='s'
    scale={'hz':1,'khz':1e3,'mhz':1e6,'ghz':1e9}[options[0]]
    fmt=options[2]
    assert fmt in ('ma','ri','db') and len(fields)==299*9
    output=[]
    for j in range(299):
        row=fields[9*j:9*j+9]
        assert abs(row[0]*scale-clock[j]) <= 1e-4
        cols=[complex(a,b) if fmt=='ri' else cmath.rect(a if fmt=='ma' else 10**(a/20),math.radians(b)) for a,b in zip(row[1::2],row[2::2])]
        output.append([cols[0],cols[2],cols[1],cols[3]])
    return output

def divide(b,a):
    p,q,r,s=a
    w,x,y,z=b
    d=p*s-q*r
    return [(w*s-x*r)/d,(x*p-w*q)/d,(y*s-z*r)/d,(z*p-y*q)/d]

def rms(values):
    xs=list(values)
    return math.sqrt(math.fsum(abs(v)**2 for v in xs)/len(xs))

def main(source, forecast, outcomes):
    assert sha256(source.read_bytes()).hexdigest()=='fb07e056ca519ab8c9637be7360617d3cfd4519cdd8b28597f53ad3c42308956'
    assert sha256(forecast.read_bytes()).hexdigest()=='365b40b99739e0d7e2ce0983bbd267da32a6e3190d23e3cd5e34c8e83dee8492'
    assert sha256(outcomes.read_bytes()).hexdigest()=='b52f031ea0e2d417c640735718803e8e9e138d98dd6e2fd8ef3c8ae8ebbe4f93'
    with zipfile.ZipFile(forecast) as f,zipfile.ZipFile(io.BytesIO(f.read('forecasts.npz'))) as z:
        assert set(z.namelist())=={a+'.npy' for a in ARMS}
        forecasts={a:read_npy(z.read(a+'.npy'),(2,299,2,2)) for a in ARMS}
    with zipfile.ZipFile(outcomes) as f,zipfile.ZipFile(io.BytesIO(f.read('held-mean-and-sweeps.npz'))) as z:
        received=read_npy(z.read('sweeps.npy'),(2,25,299,2,2))
        report=json.loads(f.read('scores.json'))
    metric_errors=[]
    raw_errors=[]
    residuals=[]
    def verify(x,y):
        diff=abs(x-y)
        metric_errors.append(diff)
        assert diff<2e-12,(x,y,diff)
    with zipfile.ZipFile(source) as outer:
        for length,name in enumerate(LENGTHS):
            with zipfile.ZipFile(io.BytesIO(outer.read('Microstrip_measurements/'+name+'.zip'))) as inn:
                members={Path(m).name.lower():m for m in inn.namelist() if m.lower().endswith('.s2p')}
                sweeps=[]
                for k in range(1,26):
                    a,b=[read_touchstone(inn.read(members[f'{name}_{letter}_{k:02d}.s2p']), report['frequency_hz']) for letter in ('a','b')]
                    obs=[entry for ai,bi in zip(a,b) for entry in divide(bi,ai)]
                    target=received[(length*25+k-1)*1196:(length*25+k)*1196]
                    raw_errors.extend(abs(x-y) for x,y in zip(obs,target))
                    sweeps.append(obs)
            truth=[sum(z)/len(z) for z in zip(*sweeps)]
            repeat=rms(x-y for row in sweeps for x,y in zip(row,truth))
            verify(repeat,report['within_connection_repeatability_rms'][length])
            summary={}
            for arm in ARMS:
                pred=forecasts[arm][length*1196:(length+1)*1196];score=report['scores'][arm]
                errors=[x-y for x,y in zip(pred,truth)]
                row=rms(errors);summary[arm]=row;verify(row,score['per_length_rmse'][length])
                for port in range(4):verify(rms(errors[port::4]),score['per_port_length_rmse'][length][port//2][port%2])
                for k,obs in enumerate(sweeps):verify(rms(x-y for x,y in zip(pred,obs)),score['all_sweep_rmse'][length][k])
                worst=score['raw_worst'][length];i=max(range(1196),key=lambda j:abs(errors[j]))
                assert (i//4,(i%4)//2+1,i%2+1)==(worst['frequency_index'],worst['output_port'],worst['input_port'])
                verify(abs(errors[i]),worst['complex_error_abs'])
                verify(truth[i],complex(*worst['truth_mean']));verify(pred[i],complex(*worst['forecast']))
                for port in range(4):verify(truth[(i//4)*4+port],complex(*worst['four_truth'][port//2][port%2]))
                for k in range(25):verify(sweeps[k][i],complex(*worst['all_25_observations'][k]))
                for model in ARMS:verify(forecasts[model][length*1196+i],complex(*worst['all_models_at_witness'][model]))
            residuals.append(summary)
    assert max(raw_errors)<2e-12
    summaries={a:(sum(item[a] for item in residuals)/2,max(item[a] for item in residuals)) for a in ARMS}
    for arm,vals in summaries.items():
        for j,key in enumerate(('equal_length_mean','worst_length_rmse')):
            verify(vals[j],report['scores'][arm][key])
            if arm!=ARMS[0]:assert (summaries[ARMS[0]][j]<vals[j])==report['gates'][arm][key]
    assert all(all(v.values()) for v in report['gates'].values())==report['joint']
    print(json.dumps({'receiver_components':len(raw_errors),'max_raw_complex_difference':max(raw_errors),'predicted_components':6*2*1196,'verified_metric_and_witnesses':len(metric_errors),'max_summary_abs_difference':max(metric_errors),'gates':report['gates'],'joint':report['joint'],'mean_worst':summaries},sort_keys=True))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ('source','forecast','outcomes'):parser.add_argument(name,type=Path)
    args=parser.parse_args()
    main(args.source,args.forecast,args.outcomes)
