"""Receive publisher headers for the sixteen Post-SPICE site-seasons before any rows."""
import hashlib
import json
from pathlib import Path
import sys
from urllib.request import Request, urlopen
from concurrent.futures import ThreadPoolExecutor

SITES = {'XBK':(907362,907363),'CAR':(907364,907365),'CCR':(907366,907367),
         'FOR':(907368,907369),'HKL':(907371,907372),'MAR':(907373,907374),
         'SOD':(907375,907376),'WFJ':(907377,907378)}

def header(item):
    site,season,doi=item
    url=f'https://doi.pangaea.de/10.1594/PANGAEA.{doi}?format=textfile&charset=UTF-8'
    req=Request(url,headers={'User-Agent':'Post-SPICE research schema receiver','Accept':'text/plain'})
    chunks=[]
    try:
        with urlopen(req,timeout=35) as r:
            first=r.readline(12000);assert first.startswith(b'/*') or first.startswith(b'\xef\xbb\xbf/*'),'unexpected source format'
            chunks.append(first)
            while not chunks[-1].strip().endswith(b'*/'):
                if sum(map(len,chunks))>180000:raise ValueError('header budget')
                b=r.readline(20000)
                if not b:raise ValueError('incomplete header')
                chunks.append(b)
            cols=r.readline(60000).decode('utf8').strip().split('\t')
            assert cols[0].lower().startswith('date/time') and len(cols)>6,'expected variable names'
            url_final=r.geturl()
        info=b''.join(chunks).decode('utf-8-sig')
        return {'site':site,'season':season,'doi':doi,'url':url_final,'columns':cols,'metadata':info,
                'header_sha256':hashlib.sha256(b''.join(chunks)).hexdigest()}
    except Exception as e:
        return {'site':site,'season':season,'doi':doi,'refusal':type(e).__name__+': '+str(e)[:200]}

def main():
    p=Path(sys.argv[1]);rows=[(site,i+1,d) for site,ds in SITES.items() for i,d in enumerate(ds)]
    with ThreadPoolExecutor(max_workers=2) as pool:out=list(pool.map(header,rows))
    f=p/'sixteen-site-season-headers.json';f.write_text(json.dumps(out,indent=2)+'\n')
    print('HEADER_ROSTER',[(x['site'],x['season'],len(x.get('columns',[])),x.get('refusal')) for x in out],flush=True)
    print('COMPLETE',hashlib.sha256(f.read_bytes()).hexdigest(),f,flush=True)
    if not all('columns' in x for x in out):raise RuntimeError('Incomplete original source header intake; see recorded per-site reason')
if __name__=='__main__':main()
