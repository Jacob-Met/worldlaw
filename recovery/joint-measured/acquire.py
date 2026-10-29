import urllib.request,json,hashlib,datetime,sys
from pathlib import Path
root=Path(__file__).resolve().parent
p=json.loads((root/'frozen-protocol.json').read_text());names=p['trainingFiles'] if sys.argv[1]=='training' else [p['heldFile']]
receipt=[]
for name in names:
 target=root/name
 if target.exists(): raise RuntimeError('Already acquired; do not silently replace '+name)
 url='https://raw.githubusercontent.com/EnzeXu/Damped_Pendulum_Dataset/'+p['revision']+'/raw_data/'+name
 with urllib.request.urlopen(url,timeout=20) as r:
  raw=r.read(2000001)
  if len(raw)>2000000:raise RuntimeError('Original exceeds acquisition cap')
 target.write_bytes(raw);receipt.append({'file':name,'url':url,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'gitBlob':hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),'acquiredUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()})
(root/('acquisition-'+sys.argv[1]+'.json')).write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))
