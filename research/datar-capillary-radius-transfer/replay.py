"""Replay the locked native and independent Datar speed comparison."""
import argparse
import hashlib
from pathlib import Path
import subprocess
import sys

HERE=Path(__file__).resolve().parent
LOCKED='43a6dd9f6b3fa74cc64cd4fc2e5020365234c91976b27496e77a99e1ca7aa603'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    if any(args.output.iterdir()):
        parser.error('output directory must be empty')
    producer=[sys.executable,str(HERE/'course.py'),str(args.workbook),str(args.output)]
    subprocess.run([*producer,'forecast'],check=True)
    observed=args.output/'forecast.json'
    if hashlib.sha256(observed.read_bytes()).hexdigest()!=LOCKED:
        raise ValueError('forecast differs from original lock')
    subprocess.run([*producer,'score',LOCKED],check=True)
    if (args.output/'scores.json').read_bytes()!=(HERE/'scores.json').read_bytes():
        raise ValueError('score packet differs from original')
    subprocess.run([sys.executable,str(HERE/'independent.py'),str(args.workbook),str(HERE/'scores.json')],check=True)

if __name__=='__main__':
    main()
