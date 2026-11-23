import hashlib,io,json,pathlib,sys,urllib.request,zipfile,gzip,shutil,subprocess
ROOT='https://zenodo.org/records/15118153/files/'
files={'readme.txt':'4eebabf0f655f7c7fdd1f9a69ac3698c','WUT000POL_R_2024068.zip':'b7e7e243b74c3226335fe5486789d2a1','WUT100POL_R_2024068.zip':'cb29126a094104b46579eb050d533b37'}
for name,md5 in files.items():
 p=pathlib.Path(name)
 url=ROOT+name+'?download=1'
 subprocess.run(['curl','--fail','--location','--silent','--show-error','--retry','2','--connect-timeout','15','--max-time','360','--max-filesize','280000000','--output',str(p),url],check=True)
 with p.open('rb') as f:
  h=hashlib.md5(); s=hashlib.sha256(); n=0
  while True:
   b=f.read(1<<20)
   if not b:break
   n+=len(b)
   if n>280000000: raise ValueError('unexpected archive size')
   h.update(b);s.update(b)
 print('ORIGINAL',name,n,h.hexdigest(),s.hexdigest(),flush=True)
 assert h.hexdigest()==md5
 if name.endswith('.txt'):
  print('PUBLIC_README',p.read_text(errors='replace'),flush=True)
  continue
 with zipfile.ZipFile(p) as z:
  for f in z.infolist():
   print('MEMBER',f.filename,f.file_size,f.compress_size,f.CRC)
  observations=[f for f in z.infolist() if f.filename.lower().endswith(('.rnx','.rnx.gz','.crx.gz','.crx','.24o','.24d','.24o.gz','.24d.gz'))]
  if not observations:
   print('NO_RECOGNIZED_OBSERVATION_MEMBER')
  unique_schemas={}
  for f in observations:
   with z.open(f) as outer:
    zi=gzip.GzipFile(fileobj=outer) if f.filename.lower().endswith('.gz') else outer
    h=[]
    for k in range(1200):
     line=zi.readline(4096)
     if not line: break
     if len(line)>512:raise ValueError('not a header line')
     if b'END OF HEADER' in line: break
     if line.startswith(b'>') or (line[:1]==b'E' and line[1:3].isdigit()):raise ValueError('measurement encountered before header terminator; preserve refusal')
     h.append(line.decode('ascii','replace').rstrip())
    else:raise ValueError('header does not end')
    if b'END OF HEADER' not in line:raise ValueError('header terminator missing')
    allowed=('RINEX VERSION / TYPE','CRINEX VERS   / TYPE','MARKER NAME','REC # / TYPE / VERS','ANT # / TYPE','INTERVAL','TIME OF FIRST OBS','TIME OF LAST OBS','SYS / # / OBS TYPES','SYS / SCALE FACTOR','SYS / PHASE SHIFT','RCV CLOCK OFFS APPL','LEAP SECONDS','PGM / RUN BY / DATE')
    fields=[row for row in h if any(key in row[59:] for key in allowed)]
    timed=[row for row in fields if 'TIME OF FIRST OBS' in row or 'TIME OF LAST OBS' in row]
    same=[row for row in fields if row not in timed and 'PGM / RUN BY / DATE' not in row]
    key=hashlib.sha256(('\n'.join(same)+'\n').encode()).hexdigest()
    unique_schemas[key]=same
    print('HEADER_BINDING',f.filename,hashlib.sha256(('\n'.join(h)+'\n').encode()).hexdigest(),key,timed,flush=True)
  for key,rows in unique_schemas.items(): print('OBSERVATION_SCHEMA',key,rows,flush=True)
print('END_SOURCE_ONLY No phase, pseudorange, Doppler, signal-strength, position, satellite ephemeris or LLI outcomes projected.')