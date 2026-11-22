"""Read publication metadata and profile identities without opening trajectory values."""
import collections
import hashlib
import json
from pathlib import Path
import sys
import urllib.error
import urllib.request
import zipfile

BASE = 'https://www.kaggle.com/api/v1/datasets/'
SLUG = 'wkirgsn/electric-motor-temperature'
EXPECTED_CSV = '78f3d150f0f2ad9c5dc7ff24dd12c00d386ad530f48c1589ad24fcd88867d3ad'
REFERENCE_ZIP = '10e49e6220fa3c8a9d22c8bab8280ffe2d5e1e3380a6a18bcfc64ea2e8b56b92'


def request(url):
    return urllib.request.urlopen(urllib.request.Request(
        url, headers={'User-Agent':'Worldlaw-PMSM-scientific-source-qualification/1.0'}),timeout=90)


def main(out):
    out.mkdir(parents=True,exist_ok=True)
    record={'publisher':SLUG,'role':'profile identities and source qualification only',
            'temperature_or_electrical_values_decoded':0}
    metadata=BASE+'view/'+SLUG
    try:
        with request(metadata) as response:
            payload=json.load(response)
        selected={k:payload[k] for k in ('id','ref','title','datasetVersionNumber','licenseName','subtitle','description') if k in payload}
        record['publisher_card']=selected
        (out/'source-card.json').write_text(json.dumps(selected,indent=2)+'\n')
        print('CARD',json.dumps(selected)[:5500],flush=True)
    except (urllib.error.URLError,ValueError) as exc:
        record['metadata_refusal']=str(exc);print('CARD_REFUSAL',str(exc),flush=True)
    locator=BASE+'download/'+SLUG
    archive=out/'publisher.zip'
    with request(locator) as response,archive.open('wb') as f:
        digest=hashlib.sha256()
        while chunk:=response.read(1024*1024):
            digest.update(chunk);f.write(chunk)
    record['archive']={'bytes':archive.stat().st_size,'sha256':digest.hexdigest(),
                       'published_external_reproduction_hash':REFERENCE_ZIP}
    with zipfile.ZipFile(archive) as z:
        members=z.infolist();record['roster']=[(a.filename,a.file_size,a.CRC) for a in members]
        info=next(a for a in members if Path(a.filename).name=='measures_v2.csv')
        h=hashlib.sha256()
        with z.open(info) as f:
            while chunk:=f.read(1024*1024):h.update(chunk)
        assert h.hexdigest()==EXPECTED_CSV
        with z.open(info) as f:
            header=f.readline().decode('utf-8-sig').strip().split(',')
            col=header.index('profile_id')
            counts=collections.Counter();runs=[]
            for raw in f:
                fields=raw.rstrip(b'\r\n').split(b',')
                assert len(fields)==len(header)
                profile=int(fields[col])
                counts[profile]+=1
                if not runs or runs[-1]!=profile:runs.append(profile)
        record.update(csv_sha256=h.hexdigest(),header=header,profile_counts=counts,
                      contiguous_run_ids=runs,row_count=sum(counts.values()),
                      profile_count=len(counts))
    result=out/'profile-metadata-only.json';result.write_text(json.dumps(record,indent=2)+'\n')
    print('SCHEMA',record['archive'],record['roster'],header,dict(counts),runs,flush=True)
    print('COMPLETE',hashlib.sha256(result.read_bytes()).hexdigest(),result,flush=True)


if __name__=='__main__':main(Path(sys.argv[1]))
