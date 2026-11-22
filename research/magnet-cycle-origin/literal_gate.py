"""Run the unmodified organizer evaluator on each eligible complete model."""
import ast
import contextlib
import hashlib
import io
import json
import os
from pathlib import Path
import re
import runpy
import sys
import tempfile
import urllib.request
import numpy as np
from score import get, git_blob, vector


def main(root, roster):
    record=json.loads(roster.read_text())
    metrics=json.loads((root/'score.json').read_text())
    expected_sha='2b86d8f139429f13e4aef01c27202be262927de1'
    path='finaltest/EvaluationKit/EvaluationKit/Accuracy%20Evaluation.py'
    url='https://raw.githubusercontent.com/minjiechen/magnetchallenge-1/'+record['revision']+'/'+path
    with urllib.request.urlopen(url,timeout=45) as h:
        script=h.read()
    assert git_blob(script)==expected_sha
    store=root/'historic-git-blobs'
    rosters={tag:[(m,comp[tag]) for m,comp in metrics['candidates'].items()] for tag in metrics['candidates']['A']}
    rosters.update({tag:list(files.items()) for tag,files in metrics['historic'].items() if len(files)==5})
    count=0
    with tempfile.TemporaryDirectory(dir=root) as tmp:
        tmp=Path(tmp)
        program=tmp/'official.py'
        program.write_bytes(script)
        for r in record['truth']:
            (tmp/f"Measured_Volumetric_Loss_Material {r['letter']}.csv").write_bytes(get(r,record['revision'],store))
        for arm,items in rosters.items():
            for m,result in items:
                if arm in record['teams']:
                    source=next(q for q in record['teams'][arm] if q['letter']==m)
                    pred=vector(get(source,record['revision'],store),source['path'],result['rows'])
                else:
                    with np.load(root/f'forecast-{m}.npz',allow_pickle=False) as pack:
                        pred=pack[arm].reshape(-1).astype(np.float64)
                np.savetxt(tmp/f'Volumetric_Loss_Material {m}.csv',pred,fmt='%.17g')
            out=io.StringIO()
            previous=Path.cwd();os.chdir(tmp)
            try:
                with contextlib.redirect_stdout(out):
                    runpy.run_path(str(program),run_name='__main__')
            finally:
                os.chdir(previous)
            lines=out.getvalue().strip().splitlines()
            assert len(lines)==11 and lines[-1]=='Evaluation is finished!'
            for j in range(5):
                material='ABCDE'[j]
                assert lines[2*j]=='Material '+material
                decoded=ast.literal_eval(lines[2*j+1])
                result=dict(items)[material]
                for key,k in [('Average','mean'),('RMS','rms'),('95_Pctl','p95'),('Maximum','max')]:
                    assert decoded[key]==float(np.round(result[k],4)),(arm,material,k,decoded[key],result[k])
                    count+=1
    out={'organizer_blob':expected_sha,'model_count':len(rosters),'model_identities':list(rosters),
         'material_groups':len(rosters)*5,'literal_printed_metrics_checked':count,
         'resolution_percent_points':.0001,'rows_per_model':27217}
    path=root/'official-gate.json'
    with path.open('x') as f:
        json.dump(out,f,indent=2)
    print('OFFICIAL',count,hashlib.sha256(path.read_bytes()).hexdigest())


if __name__=='__main__':
    main(*(Path(x) for x in sys.argv[1:]))
