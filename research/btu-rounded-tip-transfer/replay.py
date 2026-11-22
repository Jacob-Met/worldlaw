"""Replay the preregistered course from the small, byte-matched public version-1 archive."""
import argparse
import io
import json
import tempfile
import urllib.request
import zipfile
from pathlib import Path

from course import assess, digest, predict, write
from recount import run as recount


def public_v1():
    api='https://data.mendeley.com/public-api/zip/6x59x7x3ny/download/1'
    headers={'User-Agent':'source-eligibility-research/1.0','Accept':'*/*'}
    with urllib.request.urlopen(urllib.request.Request(api,method='HEAD',headers=headers),timeout=90) as h:
        uri=h.geturl()
        if int(h.headers['Content-Length'])!=1523495:
            raise ValueError('Unexpected archive size')
    headers['Range']='bytes=0-1523494'
    with urllib.request.urlopen(urllib.request.Request(uri,headers=headers),timeout=120) as f:
        if f.status!=206 or f.headers['Content-Range']!='bytes 0-1523494/1523495':
            raise ValueError('Incomplete public archive')
        return f.read(1523496)


def canonical(source, members):
    buf=io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(source)) as original, zipfile.ZipFile(buf,'w') as rebuilt:
        for name,sha in sorted(members.items()):
            names=[n for n in original.namelist() if n==name or n.endswith('/'+name)]
            if len(names)!=1:
                raise ValueError(f'Missing or duplicate {name}')
            b=original.read(names[0])
            if digest(b)!=sha:
                raise ValueError(f'Published member changed: {name}')
            meta=zipfile.ZipInfo(name,(2026,1,1,0,0,0))
            meta.compress_type=zipfile.ZIP_DEFLATED
            rebuilt.writestr(meta,b)
    return buf.getvalue()


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--archive',type=Path,help='Local original public version-1 ZIP')
    ap.add_argument('--require-original-bits',action='store_true')
    args=ap.parse_args()
    record=json.loads(Path(__file__).with_name('course-receipt.json').read_text())
    meta=record['opaque_member_sha256']
    b=args.archive.read_bytes() if args.archive else public_v1()
    if len(b)!=1523495 or digest(b)!=meta['version1_archive_sha']:
        raise ValueError('Public source checksum mismatch')
    data=canonical(b,meta['members'])
    with zipfile.ZipFile(io.BytesIO(data)) as z,tempfile.TemporaryDirectory(prefix='btu-registered-replay-') as d:
        directory=Path(d)
        for p in (6,9):
            write(directory/f'forecast-{p}.json',predict(z,p))
        cases={}
        for p in (6,9):
            path=directory/f'forecast-{p}.json'
            ff=json.loads(path.read_bytes())
            answer=assess(z,ff)
            out=directory/f'score-{p}.json'
            write(out,answer)
            fsha=digest(path.read_bytes())
            ssha=digest(out.read_bytes())
            exact=(fsha==record['forecast_receipts'][str(p)]['sha'] and ssha==record['score_receipts'][str(p)]['sha'])
            if args.require_original_bits and not exact:
                raise ValueError('Original numerical bytes differ')
            diffs=[]
            for domain,v in answer.items():
                ref=record['outcomes'][str(p)][domain]
                for key in ('center_gates','q_gates'):
                    if v[key]!=ref[key]:
                        raise ValueError(f'Changed registered gate: p{p} {domain} {key}')
                for key in ('center_six','q_six'):
                    for arm,stats in ref[key].items():
                        diffs.extend(abs(x-v[key][arm][k]) for k,x in stats.items())
            if max(diffs)>1e-9:
                raise ValueError('Score differs from published original')
            checks=recount(z,directory,p)
            cases[p]={'original_forecasts_and_scores_bit_exact':exact,'forecast_sha256':fsha,
                      'score_sha256':ssha,'max_score_difference_db':max(diffs),
                      'independent_signed_components':sum(v['signed_components'] for v in checks.values()),
                      'primary_gates':{k:answer['primary'][k] for k in ('center_gates','q_gates')}}
        print(json.dumps(cases,indent=2,sort_keys=True))


if __name__=='__main__':
    main()
