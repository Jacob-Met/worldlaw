"""Validate both chronology maps against independent organizer CSV, estimation only."""
from pathlib import Path
import hashlib
import io
import json
import sys
import zipfile
import numpy as np
from scipy.io import loadmat,whosmat
root=Path(sys.argv[1]);archive=root/'ParWHFiles.zip'
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='9d01efe9264a921f83b326ee72fdd1ba0e87063cb67265b750efb8e04a4b385d'
selected=['fs','amp','lines','uEst','yEst']
with zipfile.ZipFile(archive) as z:
    b=z.read('ParWHFiles/ParWHData.mat')
    shapes=whosmat(io.BytesIO(b));data=loadmat(io.BytesIO(b),variable_names=selected)
    assert set(k for k in data if not k.startswith('__'))==set(selected)
    U=data['uEst'];Y=data['yEst'];N,P,M,A=U.shape
    assert U.shape==Y.shape==(16384,2,20,5)
    rows=[];worst=None
    for a in range(A):
        with z.open(f'ParWHFiles/ParWHData_Estimation_Level{a+1}.csv') as h:
            header=h.readline().decode().strip().split(',')
            u0=header.index('"u"');y0=header.index('"y"')
            csv=np.genfromtxt(h,delimiter=',',usecols=range(u0,y0+M),dtype=np.float64)
        assert csv.shape==(N*P,2*M)
        for symbol,v,c in [('u',U,csv[:,:M]),('y',Y,csv[:,M:])]:
            t=v[:,:,:,a];chrono=t.transpose(1,0,2).reshape(N*P,M);literal=t.reshape(N*P,M)
            delta=c-literal
            idx=np.unravel_index(np.argmax(abs(delta)),delta.shape)
            peak=float(abs(delta[idx]))
            if worst is None or peak>worst['absolute_error']:
                sample,m=map(int,idx);worst={'kind':symbol,'amplitude_index':a,'realization':m,'row':sample,
                 'csv':float(c[idx]),'physical':float(chrono[idx]),'literal':float(literal[idx]),'absolute_error':peak,
                 'physical_source':[sample%N,sample//N],'loader_source':[sample//2,sample%2]}
            rms=lambda a:float(np.sqrt(np.mean(a*a)))
            rows.append(dict(kind=symbol,amp=a,csv_chronological_rms=rms(c-chrono),csv_chronological_peak=float(np.max(abs(c-chrono))),
                    csv_literal_rms=rms(delta),csv_literal_peak=peak,physical_step_rms=rms(np.diff(chrono,axis=0)),
                    literal_odd_step_rms=rms(literal[1::2]-literal[0::2]),literal_even_step_rms=rms(literal[2::2]-literal[1:-1:2]),
                    repeated_period_rms=rms(t[:,1]-t[:,0])))
fs=float(data['fs'].squeeze());amp=data['amp'].ravel().tolist();lines=data['lines'].ravel().astype(int)
def rms(x):return float(np.sqrt(np.mean(x*x)))
# Full-event pointwise prediction identity is preserved exactly under permutation.
physical=lambda x:x.transpose(1,0,2,3).reshape(N*P,M,A)
literal=lambda x:x.reshape(N*P,M,A)
ps,pl=physical(Y)-.37*physical(U),literal(Y)-.37*literal(U)
assert np.array_equal(ps.reshape(P,N,M,A).transpose(1,0,2,3).reshape(2*N,M,A),pl)
physical_prefix=list(range(50))
loader_prefix=[(t%2)*N+t//2 for t in range(50)]
jumps=np.diff(np.asarray([(t%2)*N+t//2 for t in range(2*N)]))
r={'fs_Hz':fs,'T_s':1/fs,'amplitudes_V':amp,'declared_lines':[len(lines),int(lines.min()),int(lines.max())],
'mat_variable_shapes':shapes,'input_output_training_only':True,'csv_rows':N*P*M*A,'measurements':rows,
'worst_training_disagreement':worst,'pointwise_full_rmse':[rms(ps),rms(pl)],'pointwise_equal_event_values':True,
'future_predecessors':int(np.sum(jumps<0)),'lag1_offsets':{str(int(k)):int(v) for k,v in zip(*np.unique(jumps,return_counts=True))},
'prefix_shared':len(set(physical_prefix)&set(loader_prefix)),'loader_50_last_physical_time_s':max(loader_prefix)/fs,
'chronological_50_last_physical_time_s':max(physical_prefix)/fs,'chronological_y_persistence_rmse':rms(np.diff(physical(Y),axis=0)),
'literal_y_persistence_rmse':rms(np.diff(literal(Y),axis=0))}
out=root/'estimation-clock-source.json';out.open('x').write(json.dumps(r,indent=2))
print('CLOCK',fs,amp,'SHA',hashlib.sha256(out.read_bytes()).hexdigest())
for x in rows:print('ROW',x['amp'],x['kind'],x['csv_chronological_peak'],x['csv_literal_rms'],x['physical_step_rms'],x['literal_odd_step_rms'])
print('WORST',worst,'PAIRPOINT',r['pointwise_full_rmse'],'LAGS',r['lag1_offsets'],'PREFIX',r['loader_50_last_physical_time_s'],r['chronological_50_last_physical_time_s'])
