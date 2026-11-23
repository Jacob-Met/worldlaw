from pathlib import Path
import hashlib,lzma,math,json,zlib,sys,io,re
from scipy.signal import butter
base=Path(sys.argv[1]);score=json.loads(Path(sys.argv[2]).read_bytes());w=score['worst']['mechanics_filter'];ix5=w['idx_5k'];trial=w['id'];directory=json.loads((base/'catalog.json').read_bytes());wanted=next(r for r in json.loads((base/'design-roster.json').read_bytes()) if r['index']==trial);target=f'/whole_{trial}.csv'
sources=[('original-packed-prefix.bin','49dd832cc1fd8f411b79aa18aae49b7c0853192acafa8d77458889c6269b546f'),('original-packed-suffix-to-index56.bin','e6ea6615a5941fdfe85d57dce21d4dca791240599e492f8bfb235ac6c829ee9b')]
def data_chunks():
 for fname,h in sources:
  with (base/fname).open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==h
  with (base/fname).open('rb') as f:
   for b in iter(lambda:f.read(262144),b''):yield b
stream=iter(data_chunks());dec=lzma.LZMADecompressor(format=lzma.FORMAT_RAW,filters=[{'id':lzma.FILTER_LZMA2,'dict_size':directory['dict_size']}])
for e in directory['entries']:
 n=e['bytes'];capture=e['name'].endswith(target);buf=bytearray();crc=0
 while n:
  chunk=dec.decompress(next(stream) if dec.needs_input else b'',max_length=min(n,524288));n-=len(chunk);crc=zlib.crc32(chunk,crc)
  if capture:buf.extend(chunk)
 assert crc==e['crc32']
 if capture:break
else:raise ValueError('missing stroke')
assert hashlib.sha256(buf).hexdigest()==wanted['sha256']
# Common Butterworth design. Advance the four causal SOS states with explicit scalar arithmetic, without scipy filtering.
sos=butter(4,[25,800],btype='bandpass',fs=50000,output='sos').tolist()
states=[[0.,0.] for _ in sos]
windows={z['idx']:z for z in w['neighbor_samples']};values=[];maxdiff=0
for idx,line in enumerate(io.BytesIO(buf)):
 if idx>max(windows)*10:break
 cells=[float(q) for q in line.strip().split(b',')];assert len(cells)==4
 if idx==0:initial=cells[3]
 y=cells[3]-initial
 for sec,st in zip(sos,states):
  a,b,c,one,d,e=sec
  assert one==1
  z=a*y+st[0];st[0]=b*y-d*z+st[1];st[1]=c*y-e*z;y=z
 if idx%10==0 and idx//10 in windows:
  j=idx//10;delta=abs(y-windows[j]['filtered_truth']);maxdiff=max(delta,maxdiff);assert delta<5e-10
  values.append(dict(index_50k=idx,measured_raw_bow_force_velocity_bridge_nut=cells,independent_filtered_truth=y))
  if j==ix5:assert cells[1:]==w['source_50k_raw_speed_bridge_nut']
assert len(values)==7
print(json.dumps(dict(id=trial,member=wanted['sha256'],index_5k=ix5,whole_source_crc32=crc,raw_rows=values,max_independent_filter_delta=maxdiff,method='independent bounded LZMA2 reader, per-member CRC, SHA, raw CSV parsing and manual scalar SOS recursion with shared Butterworth coefficients'),sort_keys=True))