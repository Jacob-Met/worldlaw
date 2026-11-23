import hashlib,json,urllib.request,csv
u='https://zenodo.org/api/records/8363718'
def get(url,limit,headers=None):
 r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'HAMON public scientific metadata reader',**(headers or {})}),timeout=25)
 with r: return r.read(limit),r.status,r.headers.get('Content-Range')
data,status,_=get(u,500000)
m=json.loads(data); files=m['files']; assert len(files)==2
meta=[{'key':f['key'],'size':f['size'],'checksum':f['checksum']} for f in files]
f=next(f for f in files if f['checksum']=='md5:b92d7a514ec78bb260e51375ef4fdea4')
b,rs,_=get(f['links'].get('content', f['links']['self']),10000);assert len(b)==f['size'] and hashlib.md5(b).hexdigest()==f['checksum'][4:]
out={'doi':m.get('doi') or m['metadata'].get('doi'),'metadata_http':status,'metadata_sha256':hashlib.sha256(data).hexdigest(),'files':meta,'readme_sha256':hashlib.sha256(b).hexdigest(),'readme_text':b.decode(),'response_rows_parsed':0}
f=next(f for f in files if f['checksum']=='md5:442e5b6ac866909d42d62a1610568995')
r=urllib.request.urlopen(urllib.request.Request(f['links'].get('content', f['links']['self']),headers={'User-Agent':'HAMON public scientific CSV header reader','Range':'bytes=0-2047'}),timeout=25)
with r:
 line=r.readline(2048);out['header_http']=r.status;out['content_range']=r.headers.get('Content-Range')
s=line.decode('utf-8-sig').strip()
fields=next(csv.reader([s]))
out['header_sha256']=hashlib.sha256(line).hexdigest()
out['header_fields']=[v for v in fields if v and all(c.isalpha() or c in ' _-[]()/.' for c in v)][:40]
out['header_field_count']=len(fields)
print(json.dumps(out,sort_keys=True))