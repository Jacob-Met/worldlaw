"""Acquire the registered central chart ROI for the development LEDs only.

All authorized image range requests carry one of the frozen public file IDs.
No list view image, target-file view, thumbnail, or multiplexed image is fetched.
"""
import concurrent.futures
import hashlib
import html
import io
import json
import os
from pathlib import Path
import re
import struct
import sys
import tempfile
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
import zipfile
import zlib

SPLIT_SHA = 'f1234fc1d4720d73a6699d1c70f97c55da34d95c97452709e77b9c33ce861587'
LIST_URL = 'https://drive.google.com/embeddedfolderview?id=0Bwoz65fi7IAEVFdod3pEWFQxcnc&resourcekey=0-CRclDZc-j1Lq47VNjlRTlA'
DIGEST = lambda x: hashlib.sha256(x).hexdigest()

class Listing(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = {}
        self.current = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'div' and a.get('id','').startswith('entry-'):
            self.current = a['id'][6:]
        if tag == 'a' and self.current and self.current in a.get('href',''):
            self.items[self.current] = a['href']

def read_page(url, max_bytes):
    with urlopen(url,timeout=60) as res:
        if urlparse(res.geturl()).hostname!='drive.google.com' or not res.headers.get('Content-Type','').startswith('text/html'):
            raise ValueError('author public listing/view unavailable')
        data=res.read(max_bytes+1)
    if len(data)>max_bytes:
        raise ValueError('metadata size')
    return data.decode()

def getrange(url, start, length):
    end=start+length-1
    req=Request(url,headers={'Range':f'bytes={start}-{end}','Accept-Encoding':'identity'})
    with urlopen(req,timeout=90) as res:
        if res.status!=206 or res.headers.get('Content-Range')!=f'bytes {start}-{end}/11059926':
            raise ValueError('source byte range or file length mismatch')
        data=res.read(length+1)
    if len(data)!=length: raise ValueError('incomplete source byte range')
    return data

def signed_view(url, file_id):
    if urlparse(url).hostname!='drive.google.com' or file_id not in urlparse(url).path or not parse_qs(urlparse(url).query).get('resourcekey'):
        raise ValueError('complete public link absent')
    p=html.unescape(read_page(url,1_500_000)).replace(r'\u003d','=').replace(r'\u0026','&').replace(r'\/','/')
    links={u for u in re.findall(r'https://drive\.usercontent\.google\.com/[^"\'<>\s]+',p) if file_id in u}
    if len(links)!=1: raise ValueError('advertised public download link unavailable')
    return links.pop()

def central_bytes(record, public_url):
    url=signed_view(public_url,record['id'])
    # The following metadata shape was qualified on three source-only header reads.
    # Strips are interpreted only after validating each current TIFF's byte order, IFD and all strip bounds.
    raw_header=getrange(url,0,8)
    if raw_header[:2]!=b'II' or struct.unpack('<HI',raw_header[2:])!=(42,11059208):
        raise ValueError('unqualified TIFF header')
    base=11059208
    tail=getrange(url,base,718)
    count=struct.unpack_from('<H',tail)[0]
    if count!=14 or struct.unpack_from('<I',tail,2+12*count)[0]!=0:
        raise ValueError('unqualified TIFF directory')
    tags={}
    for k in range(count):
        idx=2+12*k
        tag,kind,n=struct.unpack_from('<HHI',tail,idx)
        v=struct.unpack_from('<H' if (kind,n)==(3,1) else '<I',tail,idx+8)[0]
        tags[tag]=(kind,n,v)
    expected={256:2560,257:2160,258:16,259:1,262:1,274:1,277:1,278:33,284:1}
    if any(tags.get(tag)!=(3,1,x) for tag,x in expected.items()):
        raise ValueError('unsupported TIFF dimensions, storage or orientation')
    def table(tag):
        kind,n,ptr=tags[tag]
        if (kind,n)!=(4,66) or ptr<base or ptr+4*n>base+len(tail):
            raise ValueError('unqualified strip table')
        return struct.unpack_from('<66I',tail,ptr-base)
    offsets=table(273);lengths=table(279);rowbytes=5120
    if any(offsets[k]!=8+k*33*rowbytes or lengths[k]!=min(33,2160-k*33)*rowbytes for k in range(66)):
        raise ValueError('noncontiguous or compressed strips')
    band=getrange(url,8+952*rowbytes,256*rowbytes)
    crop=b''.join(band[r*rowbytes+2304:r*rowbytes+2816] for r in range(256))
    if len(crop)!=131072: raise ValueError('ROI byte length')
    return crop,{'raw_roi_sha256':DIGEST(crop),'row_band_sha256':DIGEST(band),'header_ifd_sha256':DIGEST(raw_header+tail)}

def write_frame(frame_id, record, public_url, root):
    data, receipt=central_bytes(record,public_url)
    path=root/f'{frame_id:03}.u16le'
    with path.open('xb') as f:f.write(data)
    return frame_id,receipt

def main():
    import base64
    packed=base64.b64decode(sys.argv[1],validate=True)
    split_bytes=zlib.decompress(packed)
    if DIGEST(split_bytes)!=SPLIT_SHA:raise ValueError('split mismatch')
    split=json.loads(split_bytes)
    source={int(i):r for i,r in split['frames'].items() if r['access']=='development'}
    if len(source)!=195 or any(r['name']!=f'Iled_{i}.tif' for i,r in source.items()):raise ValueError('development roster')
    listing=Listing();listing.feed(read_page(LIST_URL,6_000_000))
    if set(listing.items)!={r['id'] for r in split['frames'].values()}:raise ValueError('public directory drift')
    out=Path(tempfile.mkdtemp(prefix='tian-p3-f747-source-',dir='/var/tmp'))
    print(json.dumps({'source_directory':str(out),'target_image_reads':0,'development':len(source),'expected_roi_bytes_per_frame':131072}),flush=True)
    receipts={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        # Process batches so a failed member cannot schedule the rest of the corpus.
        ids=sorted(source)
        for k in range(0,len(ids),6):
            pending=[pool.submit(write_frame,i,source[i],listing.items[source[i]['id']],out) for i in ids[k:k+6]]
            for f in pending:
                frame_id,receipt=f.result()
                receipts[str(frame_id)]=receipt
            if len(receipts)%30==0 or len(receipts)==len(ids):
                print(json.dumps({'complete_development_frames':len(receipts)}),flush=True)
    b=(json.dumps(receipts,sort_keys=True,separators=(',',':'))+'\n').encode()
    (out/'receipts.json').write_bytes(b)
    print(json.dumps({'source_directory':str(out),'byte_receipts_sha256':DIGEST(b),'roi_count':len(receipts),'held_image_file_views_or_ranges':0}),flush=True)
if __name__=='__main__':main()
