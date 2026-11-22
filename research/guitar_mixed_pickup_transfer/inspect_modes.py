"""Explain the worst frozen modes from retained arrays, without changing a forecast."""
import argparse
import io
import json
from pathlib import Path
import tempfile
import zipfile
import numpy as np
from positive_gain_bound import dual_window,shape_lower_bound
from switch_model import Cases,positive_coils


def inspect(archive):
    with tempfile.TemporaryDirectory() as d,zipfile.ZipFile(archive) as z:
        tmp=Path(d);score=json.loads(z.read('scores.json'))
        with zipfile.ZipFile(io.BytesIO(z.read('forecast.zip'))) as f:manifest=json.loads(f.read('manifest.json'))
        for meter in ('stable','early'):
            src=tmp/'source'/meter;src.mkdir(parents=True)
            for file in ('metadata.json','training-mixed.npy','singles.npy'):(src/file).write_bytes(z.read('source/'+meter+'/'+file))
        diagnostics={'development_real_gain_envelope':dual_window(tmp),'held':{}}
        for meter,rows in score['row_metrics'].items():
            src=tmp/'source'/meter;c=Cases(src)
            a,b=positive_coils(c,manifest['fit'][meter]['shared_circuit']['theta'])
            r=max(rows,key=lambda t:t['worst_by_role']['shared_circuit'][1]);s,j,p=r['case'];k=r['candidate_worst_mode']['mode']-1
            ix=int(np.flatnonzero((c.s==s-1)&(c.j==j-1)&(c.p==p-4))[0]);v1,v2=c.A[ix],c.B[ix]
            left=a[ix,k]*v1[k];right=b[ix,k]*v2[k]
            diagnostics['held'][meter]={
                'case':r['case'],'partial':k+1,'physical_position_mm':30+20*(j-1),'source_single_peak_Hz':float(c.f[ix,k]),
                'source_single_complex_fullscale':[[float(t.real),float(t.imag)] for t in (v1[k],v2[k])],
                'relative_single_phase_deg':float(np.rad2deg(np.angle(v2[k]/v1[k]))),
                'fitted_weighted_phase_deg':float(np.rad2deg(np.angle(right/left))),
                'weighted_magnitude_ratio_right_left':float(abs(right/left)),
                'positive_scalar_envelope':shape_lower_bound(v1,v2,k),
                'target_and_all_forecasts':r['candidate_worst_mode'],
                'largest_whole_take':max(rows,key=lambda t:t['loss']['shared_circuit'])['case'],
                'whole_take_all_losses':max(rows,key=lambda t:t['loss']['shared_circuit'])['loss']}
        return diagnostics


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('archive',type=Path);a=p.parse_args()
    print(json.dumps(inspect(a.archive),sort_keys=True))
