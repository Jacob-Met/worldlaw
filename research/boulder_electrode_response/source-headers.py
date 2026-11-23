"""Qualify the released Boulder field headers and native 1-D transfer before any data rows."""
import datetime, hashlib, json, os, pathlib, subprocess, tempfile, urllib.parse, urllib.request
def emit(k,v):print(k,json.dumps(v,sort_keys=True),flush=True)
def hash_(b):return hashlib.sha256(b).hexdigest()
r=pathlib.Path(tempfile.mkdtemp(prefix='p3-boulder-qualification-',dir=os.environ.get('TMPDIR')))
pin='3ac04d05f354d891c1df2011ce2d50780589cf7f'
def git(*args):return subprocess.check_output(['git',*args],cwd=r)
git('init','-q');git('remote','add','origin','https://github.com/greglucas/bezpy.git');git('fetch','-q','--depth=1','--filter=blob:none','origin',pin)
assert git('rev-parse','FETCH_HEAD').decode().strip()==pin
for p,oid in [('bezpy/mt/site.py','982b53919ec5a23120c25c5dadba0636a44226f5'),('bezpy/mt/data_1d/earth_model_BOU.txt','a394f576facfad479468aa5d1cf3c13575963cdf'),('bezpy/mt/data_1d/00README.txt','e8372523ecb2c00ea1b03303abf96cd5e03c4703')]:
    b=git('show',pin+':'+p);assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==oid
    emit('BASELINE_SOURCE',[p,oid,hash_(b),len(b)])
# Use only the instrument paper's already published demonstration date.
# This header probe stops immediately upon reaching the DATE column line.
for k,el in [('electric','E-N,E-E'),('magnetic','X,Y')]:
    args=dict(id='BOU',elements=el,type='variation',sampling_period='1',format='iaga2002',starttime='2016-10-12T00:00:00Z',endtime='2016-10-12T00:00:01Z')
    url='https://geomag.usgs.gov/ws/data/?'+urllib.parse.urlencode(args)
    req=urllib.request.Request(url,headers={'User-Agent':'Physical-observatory-source-study/1.0'})
    try:
        with urllib.request.urlopen(req,timeout=40) as f:
            assert f.status==200
            head=[]
            for _ in range(70):
                line=f.readline(1024)
                if not line:break
                assert len(line)<1024
                t=line.decode('ascii').strip()
                if t.startswith('DATE '):
                    head.append(t);break
                assert not t[:4].isdigit(),'refuse a row before column definition'
                head.append(t)
            assert head and head[-1].startswith('DATE '),'no column definition'
            emit('PHYSICAL_HEADER',{'kind':k,'headers':head,'decoded_measurement_rows':0,'date':'2016-10-12'})
    except Exception as exc:
        emit('HEADER_REFUSAL',{'kind':k,'error':type(exc).__name__,'message':str(exc)[:200],'decoded_measurement_rows':0})
        raise
