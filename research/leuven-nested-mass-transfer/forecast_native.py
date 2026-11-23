"""Authenticate only the two admitted input archives and preserve the exact source lock."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
import zipfile

def hash_file(stream, name):
    h = hashlib.new(name)
    with stream:
        for block in iter(lambda: stream.read(1048576), b''):
            h.update(block)
    return h


ALLOWED = {'baseline':(132189456,'7b3a5b89768831fcf80942d75de84ccd'),
           '6 masses':(6423052,'9a512f9cdd0764fde58fa1a69b5dd837')}
ROOT = 'r2-estate:hamon-build-cache/research/astra62-p2-f747f5728172/leuven-subset/'
for name,(size,md5) in ALLOWED.items():
    filename=name+'.npz'
    shutil.copyfile(Path(os.environ['LEUVEN_STAGED_INPUTS'])/filename,filename)
    path=Path(filename)
    assert path.stat().st_size==size and hash_file(path.open('rb'),'md5').hexdigest()==md5
    print('INPUT',name,size,md5,flush=True)
subprocess.run([sys.executable,'subset_gain_control.py'],check=True)
subprocess.run([sys.executable,'subset_transfer.py','.'],check=True)
with zipfile.ZipFile('locked-source.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=1) as z:
    for name in ['forecasts.npy','source_admission.npy','source_report.json','prospective.json',
                 'subset_transfer.py','forecast_native.py','subset_gain_control.py','resolvent_control.py']:
        z.write(name)
path=Path('locked-source.zip')
key=hash_file(path.open('rb'),'sha256').hexdigest()+'.zip'
subprocess.run(['rclone','copyto',str(path),ROOT+key],check=True)
subprocess.run(['rclone','copyto',ROOT+key,'cold-lock.zip'],check=True)
assert hash_file(open('cold-lock.zip','rb'),'sha256').hexdigest()+'.zip'==key
print('COLD_FORECAST_LOCK',ROOT+key,path.stat().st_size,flush=True)
raw=json.load(open('source_report.json'))
for name,v in raw['source_worst'].items():
    print('RAW_SOURCE_WORST',name,json.dumps(v,separators=(',',':')),flush=True)
