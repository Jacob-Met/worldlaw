import pathlib,urllib.request as u,hashlib,json,os
os.environ['OPENBLAS_NUM_THREADS']='1';os.environ['OMP_NUM_THREADS']='1'
import numpy as np
from scipy.io import loadmat,whosmat
p=pathlib.Path('.');file=p/'official-port-data3SS.mat'
if not file.exists():
 b=u.urlopen('https://raw.githubusercontent.com/ebpfly/shmtools/747392d82d17e5ef8d1bbe31bbd696894151b0e5/examples/data/data_files/data3SS.mat',timeout=40).read();assert hashlib.sha256(b).hexdigest()=='d738160e7d0a2c422a1189e3fe6c47c6e978be068247f55dc5a94ca381773e0f';file.write_bytes(b)
assert hashlib.sha256(file.read_bytes()).hexdigest()=='d738160e7d0a2c422a1189e3fe6c47c6e978be068247f55dc5a94ca381773e0f'
x=loadmat(file);states=x['states'].ravel().astype(int);force=x['dataset'][:,0,:].T.copy();del x
np.save(p/'force.npy',force)
v=force.astype(float);rms=np.sqrt((v*v).mean(axis=1));v-=v.mean(axis=1,keepdims=True);v/=np.linalg.norm(v,axis=1)[:,None]
ff=np.fft.rfft(v,axis=1);worst=None;within=None;cross=None
for i in range(len(v)-1):
 cc=np.fft.irfft(ff[i:i+1]*ff[i+1:].conj(),n=v.shape[1],axis=1)
 for j in range(i+1,len(v)):
  row=cc[j-i-1];k=int(np.argmax(abs(row))); rec=(float(abs(row[k])),i,j,k,float(row[k]),int(states[i]),int(states[j]))
  if worst is None or rec>worst:worst=rec
  if states[i]==states[j] and (within is None or rec>within):within=rec
  if states[i]!=states[j] and (cross is None or rec>cross):cross=rec
digests=[hashlib.sha256(np.ascontiguousarray(z,dtype='<f4').tobytes()).hexdigest() for z in force]
print(json.dumps({'mat_variables':whosmat(file),'force_sha256_roster':hashlib.sha256(''.join(digests).encode()).hexdigest(),'exact_unique':len(set(digests)),'force_rms_in_file_units':[float(min(rms)),float(np.median(rms)),float(max(rms))],'largest_abs_circular_correlation_all8192_lags':worst,'largest_within_state':within,'largest_between_states':cross,'states':[(int(k),int((states==k).sum())) for k in np.unique(states)],'response_channel_values_analyzed':0}))

