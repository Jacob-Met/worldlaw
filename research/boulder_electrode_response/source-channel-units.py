import pathlib,tempfile,subprocess,json,urllib.request,hashlib,os
root=pathlib.Path(tempfile.mkdtemp(dir=os.environ.get('TMPDIR')))
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
ref='6c62aeb91a25362803b4cf6b86e466a260c33023';git('init','-q');git('fetch','-q','--depth=1','--filter=blob:none','https://github.com/IAGA-DVI-DataStandards/mth5.git',ref)
name='mth5/clients/geomag.py';src=git('show',ref+':'+name);assert hashlib.sha1(b'blob '+str(len(src)).encode()+b'\0'+src).hexdigest()=='36f2a56a127fe5753a60ab1030975f0267e2bef3'
for line in src.decode().splitlines():
 if 'ch_metadata.units =' in line or 'ch_metadata = Magnetic(' in line:print('ALTERNATE_CLIENT',line.strip(),flush=True)
for addr in ('elements/','observatories/BOU','openapi.json'):
 url='https://geomag.usgs.gov/ws/'+addr
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Observatory-source-qualification/1.0'}),timeout=40) as stream:b=stream.read(2500000)
 doc=json.loads(b);print('OFFICIAL',addr,len(b),hashlib.sha256(b).hexdigest(),flush=True)
 if addr=='openapi.json': print('SERVICE',doc['info'],list(doc['paths']),flush=True)
 elif addr=='elements/':print('ELEMENTS',json.dumps(doc)[:13500],flush=True)
 else:print('BOU',json.dumps(doc)[:12000],flush=True)
