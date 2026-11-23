"""Read only public author listing metadata. Do not contact any original image file."""
import hashlib
import json
import re
import urllib.parse
from urllib.request import urlopen

parent='https://drive.google.com/drive/folders/0Bwoz65fi7IAEWk93RjlyOTh2Q00?resourcekey=0-CUmXxAx9f5HnoPVxZ3PfYA'
def displayed_share_urls(x):
    if isinstance(x,list):
        for v in x:
            yield from displayed_share_urls(v)
    elif isinstance(x,str) and x.startswith('https://drive.google.com/'):
        yield x.replace(r'\u003d','=').replace(r'\u0026','&')

def listing(url):
    link=urllib.parse.urlparse(url)
    if link.hostname!='drive.google.com' or not link.path.startswith('/drive/folders/'):raise ValueError('expected published folder share URL')
    if 'resourcekey' not in urllib.parse.parse_qs(link.query): raise ValueError('public share link has no resource key')
    mobile=url.replace('/drive/folders/','/drive/mobile/folders/',1)
    with urlopen(mobile,timeout=30) as r:
        if urllib.parse.urlparse(r.geturl()).hostname!='drive.google.com':raise ValueError('anonymous shared-folder access unavailable')
        h=r.read(4000001)
    assert len(h)<=4000000
    m=re.search(r"window\['_DRIVE_ivd'\] = '([^']*)'",h.decode())
    if not m:raise ValueError('public file listing unavailable')
    serialized=re.sub(r'\\x([0-9a-fA-F]{2})',lambda m:chr(int(m[1],16)),m[1]).replace(r'\/','/')
    obj=json.loads(serialized)
    rows=[]
    for x in obj[0]:
        urls=list(displayed_share_urls(x))
        share=[u for u in urls if ('/'+x[0]) in u and 'resourcekey=' in u]
        row=dict(id=x[0],name=x[2],mime=x[3],public_link=share[0] if len(share)==1 else None,version_size=x[13] if isinstance(x[13],int) else None)
        rows.append(row)
    return rows
pending=[('chart',parent,0)]
seen=set()
while pending:
    group,url,depth=pending.pop(0)
    if url in seen:continue
    seen.add(url)
    rows=listing(url)
    canonical=json.dumps([(r['id'],r['name'],r['mime'],r['version_size'],r['public_link']) for r in rows],sort_keys=True,separators=(',',':')).encode()
    kinds={}
    for r in rows:
        suffix=r['name'].lower().rsplit('.',1)[-1]
        kinds[suffix]=kinds.get(suffix,0)+1
    small=[{k:v for k,v in r.items() if k!='public_link'} for r in rows] if len(rows)<=30 else [{k:v for k,v in r.items() if k!='public_link'} for r in rows[:3]+rows[-3:]]
    print(json.dumps({'folder':group,'count_in_public_listing':len(rows),'mime_or_filename_suffix_census':kinds,'listing_sha256':hashlib.sha256(canonical).hexdigest(),'displayed_children':small,'public_shared_links':sum(bool(r['public_link']) for r in rows),'file_bodies_opened':0},sort_keys=True),flush=True)
    for r in rows:
        if r['mime']=='application/vnd.google-apps.folder' and depth<4 and r['public_link'] and (depth>0 or r['name']=='data'):
            pending.append((group+'/'+r['name'],r['public_link'],depth+1))
