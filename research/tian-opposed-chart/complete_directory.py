"""Enumerate the anonymous public chart directory in list view. No files are opened."""
from html.parser import HTMLParser
import hashlib, json, re
from urllib.parse import urlparse,parse_qs,urlencode
from urllib.request import urlopen
class ListView(HTMLParser):
    def __init__(self):
        super().__init__(); self.items=[]; self.item=None; self.title=False
    def handle_starttag(self,t,attrs):
        a=dict(attrs)
        if t=='div' and a.get('id','').startswith('entry-'):
            self.item={'id':a['id'][6:]};self.items.append(self.item)
        if t=='a' and self.item is not None and 'href' in a and self.item['id'] in a['href']:
            self.item['href']=a['href']
        if t=='div' and 'flip-entry-title' in a.get('class','').split():self.title=True
    def handle_endtag(self,t):
        if t=='div' and self.title:self.title=False
    def handle_data(self,s):
        if self.title and self.item is not None:self.item['name']=self.item.get('name','')+s
folder='https://drive.google.com/drive/folders/0Bwoz65fi7IAEVFdod3pEWFQxcnc?resourcekey=0-CRclDZc-j1Lq47VNjlRTlA'
p=urlparse(folder)
url='https://drive.google.com/embeddedfolderview?'+urlencode({'id':p.path.split('/')[-1],'resourcekey':parse_qs(p.query)['resourcekey'][0]})
with urlopen(url,timeout=30) as r:
    if urlparse(r.geturl()).hostname!='drive.google.com':raise ValueError('anonymous public embed unavailable')
    b=r.read(6_000_001)
assert len(b)<=6_000_000
view=ListView();view.feed(b.decode());items=view.items
print('CENSUS',json.dumps({'items':len(items),'page_bytes':len(b),'entry_ids':b.count(b'id="entry-'),'image_files_read':0}),flush=True)
assert items and len({x['id'] for x in items})==len(items) and all(x.get('name') for x in items)
manifest=sorted([(x['name'],x['id']) for x in items]);print('NAME_ID_ROSTER',json.dumps(manifest,separators=(',',':')),flush=True)
print('UNCLASSIFIED',json.dumps([x['name'] for x in items if not re.fullmatch(r'Iled_\d+\.tif',x['name'])]),flush=True)
