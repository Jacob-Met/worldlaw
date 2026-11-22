"""Rebuild the frozen forecasts and repeat the independent numerical receiver."""
import argparse
import json
import os
from pathlib import Path
import sys

# Freeze BLAS and histogram runtime before importing dependencies.
for key in ('OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','OMP_NUM_THREADS'):
    os.environ[key]='1'

import independent
import intake
import observer
import train_intake


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    out=args.output.resolve()
    out.mkdir(parents=True,exist_ok=False)
    source=out/'source'
    training=out/'training'
    dev=out/'development'
    intake.main(source)
    train_intake.main(source,training)
    observer.main(source,training,dev)
    result=independent.receive(dev)
    expected=json.loads(Path(__file__).with_name('observed.json').read_text())['receiver']
    # Archive JSON stores witness coordinates as arrays; compare using the same representation.
    result=json.loads(json.dumps(result))
    for key in ('forecasts','profile_rows','scores','locked_forecasts','gate','witnesses'):
        assert result[key]==expected[key],key
    print(json.dumps(result,sort_keys=True))


if __name__=='__main__':main()
