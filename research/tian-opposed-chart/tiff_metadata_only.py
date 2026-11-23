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

import html,struct
from urllib.request import Request
from urllib.parse import unquote
byname={x['name']:x for x in items}
for label in (1,147,293):
    name=f'Iled_{label}.tif'
    row=byname[name]
    u=row.get('href','')
    print('SHARE',label,urlparse(u).hostname,urlparse(u).path.split('/')[1:3],bool(parse_qs(urlparse(u).query).get('resourcekey')),flush=True)
    if urlparse(u).hostname!='drive.google.com':raise ValueError('public file share missing')
    with urlopen(u,timeout=30) as rr:
        if urlparse(rr.geturl()).hostname!='drive.google.com':raise ValueError('explicit share access unavailable')
        if not rr.headers.get('Content-Type','').startswith('text/html'):raise ValueError('public metadata view unavailable')
        page=rr.read(1_500_001)
    assert len(page)<=1_500_000
    normalized=html.unescape(page.decode()).replace(r'\u003d','=').replace(r'\u0026','&').replace(r'\/','/')
    urlset={x for x in re.findall(r'https://drive\.usercontent\.google\.com/[^"\'<>\s]+',normalized) if row['id'] in x}
    assert len(urlset)==1,'one advertised download URL required'
    fileurl=urlset.pop()
    def getrange(i,n):
        assert 0<n<=2048 and i>=0
        req=Request(fileurl,headers={'Range':f'bytes={i}-{i+n-1}','Accept-Encoding':'identity'})
        with urlopen(req,timeout=30) as res:
            cr=res.headers.get('Content-Range','')
            if res.status!=206 or not re.fullmatch(rf'bytes {i}-{i+n-1}/[0-9]+',cr):raise ValueError('precise range not supported; no body accepted')
            size=int(cr.split('/')[1]);bb=res.read(n+1);assert len(bb)==n
        return bb,size
    header,size=getrange(0,8)
    if header[:2] not in [b'II',b'MM']:raise ValueError('not classic TIFF')
    e='<' if header[:2]==b'II' else '>'
    magic,off=struct.unpack(e+'HI',header[2:]);assert magic==42 and 8<=off<size-2
    count=struct.unpack(e+'H',getrange(off,2)[0])[0]
    assert 0<count<=128
    t=getrange(off+2,12*count+4)[0]
    entries={}; text_fields={}
    for pos in range(count):
        seg=t[12*pos:12*pos+12];tag,typ,num=struct.unpack(e+'HHI',seg[:8])
        val=struct.unpack(e+'I',seg[8:])[0];entries[tag]=[typ,num,val]
        if typ==3 and num==1:entries[tag][2]=struct.unpack(e+'H',seg[8:10])[0]
        if tag in [269,270,271,272,305,306] and typ==2 and 1<=num<=1024:
            bb=seg[8:8+num] if num<=4 else getrange(val,num)[0]
            text_fields[tag]=bb.decode('ascii','replace').rstrip('\x00')
    next_ifd=struct.unpack(e+'I',t[-4:])[0]
    print('TIFF_METADATA',json.dumps({'name':name,'size':size,'first_ifd':off,'next_ifd':next_ifd,'tags':entries,'text_tags':text_fields,'image_strip_or_tile_reads':0},sort_keys=True),flush=True)
