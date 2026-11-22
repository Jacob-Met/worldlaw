"""Score the resource-frozen complex vector forecasts over complete runs."""
import numpy as np
from response import unpack
import json

def score(pred, outcomes, cohort):
    rows = {}
    for name, p in pred.items():
        if set(p) != set(outcomes) or len(p) != 8:
            raise ValueError("Eight exact held outcomes and predictions are required")
        rows[name] = {}
        for case in sorted(p, key=int):
            y = unpack(outcomes[case]['y'])
            yhat = unpack(p[case])
            err = yhat - y
            if np.linalg.norm(y) < 1e-8:
                raise ValueError("Unqualified near-zero held load phasor")
            rows[name][case] = {'absolute_nm':float(np.linalg.norm(err)),
                                'relative':float(np.linalg.norm(err)/np.linalg.norm(y)),
                                'component_nm':abs(err).tolist(),
                                'within_run_block_deviation_nm':[float(np.linalg.norm(b-y)) for b in unpack(outcomes[case]['blocks_y'])]}
    subsets = {'aligned_2':cohort['aligned']['held2'],'aligned_4':cohort['aligned']['held4'],
               'aligned_all':cohort['aligned']['held2']+cohort['aligned']['held4'],
               'yaw_minus20_exact':[1035,1040,1042], 'yaw_minus20_off_nominal':[1037],
               'all8':[989,994,991,996,1035,1040,1037,1042]}
    table = {}
    for name, r in rows.items():
        table[name]={}
        for subset, cases in subsets.items():
            values = [r[str(c)] for c in cases]
            table[name][subset]={'mean_absolute_nm':float(np.mean([t['absolute_nm'] for t in values])),
                                 'mean_relative':float(np.mean([t['relative'] for t in values])),
                                 'worst_absolute_nm':max(t['absolute_nm'] for t in values)}
    # All prespecified measured-input full matrices compete on identical realized forcing.
    gates={}
    for b in ('common_equal_gain','common_absolute','affine_gain'):
        for sub in ('aligned_2','aligned_4'):
            gates[b+'_'+sub+'_mean_absolute']=table['cubic_gain'][sub]['mean_absolute_nm']<table[b][sub]['mean_absolute_nm']
        gates[b+'_aligned_all_worst']=table['cubic_gain']['aligned_all']['worst_absolute_nm']<=table[b]['aligned_all']['worst_absolute_nm']
    return {'table':table,'rows':rows,'gates':gates,'joint':all(gates.values())}
