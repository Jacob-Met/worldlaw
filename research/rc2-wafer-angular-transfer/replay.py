"""Rebuild eight forecasts before scoring the FAIRmat RC2 acquisition."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.request import urlopen

from recount import verify

ROOT = Path(__file__).resolve().parent
URL = ('https://raw.githubusercontent.com/FAIRmat-NFDI/pynxtools-ellips/'
       'dc620d7d47c97c3c0c6140ffb46060103eab35ac/examples/test-data.dat')
LOCK_SHA = '4855ad5d1bbd812333b631ad51d4610124ffba6cf18536f928042c0bf82820e2'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--vendor-file', type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as temp:
        work = Path(temp)
        raw = args.vendor_file or (work / 'test-data.dat')
        if args.vendor_file is None:
            raw.write_bytes(urlopen(URL, timeout=60).read())
        lock = work / 'forecast.json'
        runner = [sys.executable, str(ROOT / 'angular_course.py')]
        subprocess.run([*runner, 'predict', str(raw), str(lock)], check=True)
        output = subprocess.check_output([*runner, 'score', str(raw), str(lock)])
        saved = lock.read_bytes()
        reference = json.loads((ROOT / 'native-result.json').read_bytes())
        rebuilt = json.loads(output)
        assert set(reference['metrics']) == set(rebuilt['metrics'])
        differences = []
        for arm, ref in reference['metrics'].items():
            actual = rebuilt['metrics'][arm]
            differences.extend(abs(actual[k] - ref[k]) for k in ('rms','worst_region_rms'))
            differences.extend(abs(a-b) for a,b in zip(actual['region_rms'],ref['region_rms']))
            assert actual['worst']['index'] == ref['worst']['index']
            differences.append(abs(actual['worst']['error'] - ref['worst']['error']))
        assert max(differences) < 2e-7 and reference['joint_pass'] == rebuilt['joint_pass']
        independent = verify(raw.read_bytes(), saved, output)
        assert independent['thresholds_passed'] == 12 and independent['thresholds_total'] == 14
        print(json.dumps({'frozen_lock_byte_match': hashlib.sha256(saved).hexdigest()==LOCK_SHA,
                          'max_abs_published_metric_difference': max(differences),
                          'independent_recount': independent}, sort_keys=True))


if __name__ == '__main__':
    main()
