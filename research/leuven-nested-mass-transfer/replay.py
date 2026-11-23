"""Recount the two published immutable archives without network or fitted models."""
import argparse
import hashlib
import json
from pathlib import Path
from independent_outcome import recount
from independent_source import check

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1<<20),b''):h.update(block)
    return h.hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('forecasts',type=Path)
    parser.add_argument('outcomes',type=Path)
    args=parser.parse_args()
    receipt=json.loads(Path(__file__).with_name('comparison.json').read_text())
    assert sha(args.forecasts)==receipt['forecast_archive_sha256']
    assert sha(args.outcomes)==receipt['outcome_archive_sha256']
    print(json.dumps({'calibration':check(args.forecasts),'score':recount(args.forecasts,args.outcomes)},
                     indent=2,sort_keys=True))

if __name__=='__main__':main()
