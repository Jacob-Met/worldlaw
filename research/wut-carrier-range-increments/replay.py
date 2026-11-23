"""Portable raw-source reproduction of the registered development result."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from projection import digest, read

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('archives',type=Path)
    a=p.parse_args()
    here=Path(__file__).resolve().parent
    published=json.loads((here/'result.json').read_text())
    with tempfile.TemporaryDirectory() as scratch:
        bank=Path(scratch)/'forecast.json.gz'
        score=Path(scratch)/'score.json.gz'
        subprocess.run([sys.executable,str(here/'forecast.py'),str(a.archives),str(bank)],check=True)
        subprocess.run([sys.executable,str(here/'score.py'),str(a.archives),str(bank),digest(bank),str(score)],check=True)
        data=read(score)
        for arm,metrics in published['aggregate'].items():
            for label,expected in metrics.items():
                if abs(data['aggregate'][arm][label]-expected)>5e-10:
                    raise ValueError(f'{arm} {label} exceeds portable numerical tolerance')
        for label,gate in published['gates'].items():
            actual=data['gates'][label]
            if actual['passed']!=gate['passed'] or actual['comparator']!=gate['comparator']:
                raise ValueError('registered result mismatch '+label)
        subprocess.run([sys.executable,str(here/'raw_recount.py'),str(a.archives),str(bank),str(score)],check=True)
        print(json.dumps(dict(forecast_sha256=digest(bank),score_sha256=digest(score),joint=data['joint_pass'],
            portable_aggregate_tolerance_m=5e-10),sort_keys=True))
if __name__=='__main__':
    main()
