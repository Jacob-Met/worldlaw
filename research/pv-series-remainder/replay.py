"""Replay the frozen two-stage course from the public archive or a local copy."""
import argparse
import hashlib
import io
import json
import tempfile
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

from forecast import ARCHIVE_SHA, forecast
from recount import recount
from score import score


def acquire():
    uri = 'https://data.mendeley.com/public-api/zip/sc3y5gks5d/download/1'
    headers = {'User-Agent': 'source-eligibility-research/1.0', 'Accept': '*/*'}
    req = urllib.request.Request(uri, method='HEAD', headers=headers)
    with urllib.request.urlopen(req, timeout=90) as resp:
        issued = resp.geturl()
        if urllib.parse.urlsplit(issued).hostname != 'prod-dcd-datasets-cache-zipfiles.s3.eu-west-1.amazonaws.com':
            raise ValueError('unexpected download host')
    with urllib.request.urlopen(urllib.request.Request(issued, headers=headers), timeout=120) as resp:
        return resp.read(52947666)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, help='local unmodified version 1 Mendeley zip')
    parser.add_argument('--require-original-bits', action='store_true')
    args = parser.parse_args()
    here = Path(__file__).resolve().parent
    reference = json.loads((here/'original-scores.json').read_text())
    original_manifests = json.loads((here/'forecast-hashes.json').read_text())
    blob = args.archive.read_bytes() if args.archive else acquire()
    if len(blob) != 52947665 or hashlib.sha256(blob).hexdigest() != ARCHIVE_SHA:
        raise ValueError('archive identity mismatch')
    with tempfile.TemporaryDirectory(prefix='pv-remainder-replay-') as work:
        base = Path(work)
        fitted = {stage:forecast(blob, base/stage, stage) for stage in ('development','final')}
        results = {}
        for stage,m in fitted.items():
            location = base/stage
            b = (location/'forecasts.npz').read_bytes()
            result = score(blob, io.BytesIO(b), m)
            exact = m['prediction_hashes'] == original_manifests[stage]['prediction_hashes']
            if args.require_original_bits and not exact:
                raise ValueError(f'{stage} prediction SHA mismatch')
            if result['gates'] != reference[stage]['gates'] or result['joint'] != reference[stage]['joint']:
                raise ValueError(f'{stage} gate mismatch')
            differences = []
            for key,by_arm in reference[stage]['per_run'].items():
                for arm,fields in by_arm.items():
                    if fields['n'] != result['per_run'][key][arm]['n']:
                        raise ValueError('trial length mismatch')
                    differences.extend(abs(fields[k]-result['per_run'][key][arm][k])
                                       for k in ('rmse_V','mae_V','max_abs_V'))
            packet = io.BytesIO()
            with zipfile.ZipFile(packet,'w') as z:
                z.writestr('forecasts.npz',b)
                z.writestr('manifest.json',json.dumps(m))
            audit = recount(blob,packet.getvalue(),result)
            results[stage] = {'forecast_bytes_match':exact,'max_abs_score_difference_V':max(differences),
                              'joint':result['joint'],'summary':result['summary'],'raw_recount':audit}
            if max(differences) > 1e-5:
                raise ValueError(f'{stage} portable metrics exceed tolerance: {max(differences)} V')
        print(json.dumps(results,indent=2,sort_keys=True))


if __name__ == '__main__':
    main()
