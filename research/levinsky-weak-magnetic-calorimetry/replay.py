"""Run the frozen field holdout, then the independent raw-source receiver."""
import argparse
import hashlib
from pathlib import Path
import subprocess
import sys
DIR=Path(__file__).resolve().parent
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('archive',type=Path)
    p.add_argument('output',type=Path)
    args=p.parse_args()
    args.output.mkdir(parents=True,exist_ok=True)
    if any(args.output.iterdir()):p.error('output directory must be empty')
    cmd=[sys.executable,str(DIR/'supported_course.py'),str(args.archive),str(args.output)]
    subprocess.run([*cmd,'train'],check=True)
    locked=args.output/'predictions.json'
    if locked.read_bytes()!=(DIR/'predictions.json').read_bytes():raise ValueError('forecast identity')
    subprocess.run([*cmd,'score',hashlib.sha256(locked.read_bytes()).hexdigest()],check=True)
    scored=args.output/'score.json'
    if scored.read_bytes()!=(DIR/'score.json').read_bytes():raise ValueError('score identity')
    subprocess.run([sys.executable,str(DIR/'independent.py'),str(args.archive),str(locked),str(scored)],check=True)
if __name__=='__main__':
    main()
