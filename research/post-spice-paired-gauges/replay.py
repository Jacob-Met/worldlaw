"""Rebuild Post-SPICE acquisition support and the two-site retrospective comparison."""
import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

from clock_audit import read as flag_clocks
from diagnostic import main as compare
from primary import extract
from receive import audit
from schema import SITES, header
from support import inventory


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('work',type=Path)
    work=parser.parse_args().work.resolve()
    work.mkdir(exist_ok=True,parents=True)
    root=Path(__file__).resolve().parent
    frozen=json.loads((root/'observed.json').read_text())
    cases=[(s,i,d) for s,ds in SITES.items() for i,d in enumerate(ds,1)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        headers=list(pool.map(header,cases))
        assert all('columns' in r for r in headers), 'Published headers unavailable'
        roster=list(pool.map(inventory,headers))
    assert len(roster)==len(frozen['support'])==16
    for r,expected in zip(roster,frozen['support']):
        for k,v in expected.items():
            if k=='total_error_amplification_quantiles' and v is not None:
                np.testing.assert_allclose(r[k],v,atol=1.e-10,rtol=0)
            else:assert r[k]==v,(r['site'],r['season'],k)
    earlier,later=[flag_clocks('MAR',i,d) for i,d in enumerate(SITES['MAR'],1)]
    assert len(earlier['alltimes'] & later['alltimes'])==48
    overlap=earlier['alltimes'] & later['alltimes']
    assert len(earlier['full'] & later['full'])==48 and later['summary']['odd_date_n']==48
    assert [min(overlap),max(overlap)]==later['summary']['odd_date_span']
    bratts=flag_clocks('XBK',2,SITES['XBK'][1])
    assert len(bratts['presence'])==9376 and not bratts['full']
    assert bratts['summary']['top_flag_tuples'][0]==(('', '', ''),9370)
    hp=work/'headers.json';sp=work/'support.json'
    hp.write_text(json.dumps(headers));sp.write_text(json.dumps(roster))
    extract(hp,sp,work/'training','train')
    compare(work/'diagnostic',work/'training',hp,sp)
    checked=audit(roster,work/'diagnostic')
    baseline=frozen['metrics']['independent']
    assert checked['forecast_stream_count']==baseline['forecast_stream_count']==261968
    for site in ('CAR','MAR'):
        a,b=checked['sites'][site],baseline['sites'][site]
        assert (a['rows'],a['best'])==(b['rows'],b['best']) and set(a['all_rmse'])==set(b['all_rmse'])
        for arm in a['all_rmse']:
            np.testing.assert_allclose(a['all_rmse'][arm],b['all_rmse'][arm],rtol=0,atol=2e-8)
        assert a['ratio']>.95
    print('VERIFIED',checked['forecast_stream_count'],{s:checked['sites'][s]['ratio'] for s in ('CAR','MAR')})
    print('The complete three-site gate is unestimable. Seven external reference seasons remain unopened.')


if __name__=='__main__':
    main()
