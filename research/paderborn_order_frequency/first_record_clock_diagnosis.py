import hashlib,io,json,re,zipfile
from pathlib import Path
import libarchive
import numpy as np
from scipy.io import loadmat
root=Path('/var/tmp/p3-f747-kat-physical-86a79d99');head=root/'source';work=root/'work'
reg=json.loads((head/'independent-archive-lock.json').read_text())
entry=next(r for r in reg['files'] if r['name']=='K001.rar');p=work/'archives/K001.rar'
with p.open('rb') as f: assert hashlib.file_digest(f,'sha256').hexdigest()==entry['sha256']
assert p.stat().st_size==entry['size']
prior=(work/'development'/'K001.npz').exists()
wanted={'N15_M07_F10','N09_M07_F10'};first=None
with libarchive.file_reader(str(p)) as arch:
 for m in arch:
  label=Path(m.pathname.replace(chr(92),'/')).name
  match=re.fullmatch(r'(N\d\d_M\d\d_F\d\d)_K001_(\d+)\.mat',label)
  if not match or match.group(1) not in wanted:continue
  raw=b''.join(m.get_blocks());record=loadmat(io.BytesIO(raw),squeeze_me=True,struct_as_record=False)[Path(label).stem]
  channels={str(y.Name):y for y in np.atleast_1d(record.Y)};out={}
  for role in ('speed','vibration_1'):
   channel=channels[role];axis=np.atleast_1d(record.X)[int(channel.XIndex)-1]
   native=np.asarray(axis.Data).reshape(-1);t=native.astype(np.longdouble);n=len(t);delta=np.diff(t);median=np.median(delta);ideal=t[0]+np.arange(n,dtype=np.longdouble)*(t[-1]-t[0])/(n-1);dev=t-ideal;j=int(np.argmax(abs(dev)));ulp=np.spacing(np.max(np.abs(native)));tol=min(6*ulp,median/8)
   out[role]={'name':str(channel.Name),'physical_unit':str(channel.Unit),'x_index':int(channel.XIndex),'raster':str(axis.Raster),'native_time_dtype':native.dtype.str,'samples':n,'time_sha256':hashlib.sha256(np.asarray(native,dtype='<f8').tobytes()).hexdigest(),'max_abs_deviation':float(abs(dev[j])),'deviation_samples':float(abs(dev[j])/median),'tolerance':float(tol),'fraction_outside_bound':float(np.mean(abs(dev)>tol)),'peak_index':j,'actual':float(t[j]),'affine':float(ideal[j]),'min_dt':float(delta.min()),'max_dt':float(delta.max()),'median_rate':float(1/median),'mean_rate':float((n-1)/(t[-1]-t[0])),'time_unit':str(axis.Unit),'uniform_gate':bool(abs(dev[j])<=tol and ulp<=median/8)}
  first={'first_matching_member':label,'mat_sha256':hashlib.sha256(raw).hexdigest(),'whole_K001_sha256':entry['sha256'],'bytes':len(raw),'complete_unit_product_exists':prior,'channel_clock_metadata':out,'signal_samples_read_by_diagnostic_code':0,'eligible_mat_materialized':1,'spectra_computed_by_diagnostic':0,'other_bearings_opened':0}
  break
assert first is not None;print('CLOCK_DIAGNOSIS',json.dumps(first,sort_keys=True))
