"""Replay the two predeclared source-site development dates, without opening Oceano."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np

from archive_reader import get
from author_receiver import main as workbook_recount
from course import fit, predict, score
from extract import build
from receive import receive


def check(condition,message):
    if not condition:raise ValueError(message)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('work',type=Path,help='private output/scratch directory')
    parser.add_argument('--cache',type=Path,help='optional directory of released source text members')
    args=parser.parse_args();work=args.work.resolve()
    work.mkdir(exist_ok=True,parents=True)
    cache=(args.cache or work/'cache').resolve()
    gold=json.loads(Path(__file__).with_name('observed.json').read_text())
    for split in ['train','development']:
        manifest=build(split,cache,work/'features')
        actual=json.loads(manifest.read_text())
        check(set(actual)==set(gold['members'][split]),'Dated source member roster differs')
        for block,r in actual.items():
            check([r['wind_sha256'],r['count_sha256']]==gold['members'][split][block],'Released input bytes differ')
        if split=='train':
            (work/'fit').mkdir(exist_ok=True);fit(work/'features',work/'fit')
    (work/'out').mkdir(exist_ok=True);predict(work/'features',work/'fit',work/'out');score(work/'out')
    # The independent receiver checks the original raw timestamps, unique finite samples,
    # all issue labels and every probability's score against a separate implementation.
    if cache!=(work/'cache'):
        link=work/'cache'
        if not link.exists():link.symlink_to(cache,target_is_directory=True)
        check(link.resolve()==cache,'Existing replay cache differs')
    receive(work)
    result=json.loads((work/'out/independent-recount.json').read_text())
    check(result['coverage']==gold['coverage'],'Development coverage or observed labels differ')
    check(result['advance']==gold['advance'],'Frozen advance decision differs')
    check(set(result['results'])==set(gold['results']),'Method roster differs')
    for arm,days in result['results'].items():
        check(set(days)==set(gold['results'][arm]),'Date roster differs')
        for day,vals in days.items():
            check(np.allclose(vals,gold['results'][arm][day],atol=2e-7,rtol=0),'Physical replay differs: '+arm+' '+day)
    book=work/'source-minute-workbook.xlsx'
    if not book.is_file():
        with get('https://zenodo.org/records/574896/files/SaltationThresholds_ThreeSites_1minute.xlsx?download=1') as src:book.write_bytes(src.read())
    check(hashlib.sha256(book.read_bytes()).hexdigest()==gold['workbook_sha256'],'Author workbook bytes differ')
    argv=sys.argv[:]
    try:
        sys.argv=['author_receiver.py',str(work/'features'),str(cache),str(book),str(work/'out')]
        workbook_recount()
    finally:sys.argv=argv
    auth=json.loads((work/'out/author-source-minute-reconstruction.json').read_text())['measurement']
    for k in ['matches','max_abs_fq','mae_fq','measured_u_count','u_mae_m_s','u_max_m_s']:
        check(abs(auth[k]-gold['source_workbook'][k])<=1e-9,'Published minute comparison differs: '+k)
    print('VERIFIED',result['prediction_cells'],result['issues'],result['ratios'],result['advance'])
if __name__=='__main__':main()
