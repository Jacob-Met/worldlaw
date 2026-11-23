"""Read the author-shared MATLAB parameter file and visible folder navigation only."""
import hashlib
import html
from html.parser import HTMLParser
import json
import re
from urllib.parse import urlparse, urljoin
from urllib.request import urlopen

share = 'https://drive.google.com/file/d/0Bwoz65fi7IAEcUxhbzB5Smc4MWc/view?usp=drivesdk&resourcekey=0-z6_h2qV9ZbAvP9J30TLJCw'
folder='https://drive.google.com/drive/mobile/folders/0Bwoz65fi7IAEVFdod3pEWFQxcnc?resourcekey=0-CRclDZc-j1Lq47VNjlRTlA'
hosts={'drive.google.com','drive.usercontent.google.com'}
def public(url,limit):
    assert urlparse(url).scheme=='https' and urlparse(url).hostname in hosts
    with urlopen(url,timeout=30) as res:
        end=urlparse(res.geturl())
        if end.hostname not in hosts:raise ValueError('public page redirected to other host: '+str(end.hostname))
        buf=res.read(limit+1)
        if len(buf)>limit:raise ValueError('byte ceiling')
        return buf
class Elem(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.events=[]
    def handle_starttag(self,t,attrs):
        a=dict(attrs)
        if t=='a' and 'href' in a:self.links.append((a['href'],a.get('aria-label',''),a.get('rel',''),a.get('id','')))
        if 'Download' in str(a.get('aria-label','')): self.events.append((t,a.get('id','')))
def canon(t):
    return html.unescape(t).replace(r'\u003d','=').replace(r'\u0026','&').replace(r'\/','/')
def main():
    folderhtml=public(folder,4_000_000).decode()
    links=Elem();links.feed(folderhtml)
    print('FOLDER_PAGINATION',[(urlparse(h).path,sorted(k.split('=')[0] for k in urlparse(h).query.split('&')),label,rel) for h,label,rel,i in links.links if 'next' in (label+' '+rel+' '+i).lower() or any(k in h.lower() for k in ['page=','page_token=','pagetoken='])],flush=True)
    body=public(share,1_500_000).decode()
    view=Elem();view.feed(body)
    normalized=canon(body)
    urls=set(re.findall(r'https://drive\.usercontent\.google\.com/[^"\'<>\s]+',normalized))
    literal=sorted({canon(h) for h,l,r,i in view.links if ('download' in (i+l+h).lower()) and '0Bwoz65fi7IAEcUxhbzB5Smc4MWc' in canon(h)} | {u for u in urls if '0Bwoz65fi7IAEcUxhbzB5Smc4MWc' in u})
    print('PARAM_VIEW',{'title':re.findall(r'<title>([^<]*)',body),'label':view.events,'advertised_download_paths':[(urlparse(u).hostname,urlparse(u).path) for u in literal]},flush=True)
    if len(literal)!=1:raise ValueError('single published parameter download link unavailable')
    b=public(literal[0],4000)
    if len(b)!=2420:raise ValueError('public parameter length differs from folder metadata')
    print('AUTHOR_PARAMETER',json.dumps({'length':len(b),'sha256':hashlib.sha256(b).hexdigest(),'source':b.decode('utf-8-sig')}),flush=True)
main()
