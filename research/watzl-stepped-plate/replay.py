"""Replay every scan location from the public sources and compare with the pre-caliper lock."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import urllib.request
import numpy as np

HERE=Path(__file__).resolve().parent
DATA="https://zenodo.org/records/13149584/files/"
PAPER="https://www.researchgate.net/profile/Georg-Watzl/publication/383852778_Simultaneous_laser_ultrasonic_measurement_of_sound_velocities_and_thickness_of_plates_using_combined_mode_local_acoustic_spectroscopy/links/66ebd416c0570c21fea8e83f/Simultaneous-laser-ultrasonic-measurement-of-sound-velocities-and-thickness-of-plates-using-combined-mode-local-acoustic-spectroscopy.pdf"
FILES={'AA7075_steps_demonstration.mat':'scan','AA7075_pattern_variation_peakFinding_results.mat':'separate_pattern',
       'Rayleigh-Lamb-equations_numerical_solution.mat':'chart','author-uploaded-paper.pdf':'paper'}
def prepare(directory):
    pins=json.loads((HERE/'protocol.json').read_text())['frozen_sources']
    directory.mkdir(exist_ok=True,parents=True)
    for name,key in FILES.items():
        p=directory/name
        if not p.exists():
            req=urllib.request.Request(PAPER if key=='paper' else DATA+name+'?download=1',headers={'User-Agent':'WORLDLAW/1.0 scientific reproduction'})
            with urllib.request.urlopen(req,timeout=90) as stream:raw=stream.read()
            assert hashlib.sha256(raw).hexdigest()==pins[key],name
            p.write_bytes(raw)
        assert hashlib.sha256(p.read_bytes()).hexdigest()==pins[key],name

def replay(directory,work):
    directory=directory.resolve();work=work.resolve();work.mkdir(exist_ok=True,parents=True)
    prepare(directory);os.environ['WATZL_DATA']=str(directory)
    env={**os.environ,'OPENBLAS_NUM_THREADS':'1','OMP_NUM_THREADS':'1','MKL_NUM_THREADS':'1'}
    frozen=json.loads((HERE/'observed.json').read_text())
    for script in ['comlas_author.py','wave_forecast.py']:
        subprocess.run([sys.executable,HERE/script],cwd=work,env=env,check=True)
    parity=json.loads((work/'author-arithmetic-parity.json').read_text())
    for k,x in parity['methods'].items():
        assert x['counts_by_root_number']=={'0':0,'1':21,'2':0}
        for name,value in x['worst_relative_errors'].items():
            assert abs(value-frozen['parity'][k][name])<1.e-11
    pred=work/'wave-forecast.json'
    forecast=json.loads(pred.read_text())
    rows=forecast['rows']
    assert [r['i'] for r in rows]==list(range(301))
    assert all(len(r['CoMLAS'][k])==1 for r in rows for k in ['eq8','exact'])
    peaks=np.array([r['peaks_Hz'] for r in rows])
    np.testing.assert_allclose(peaks,frozen['locked_peaks_Hz'],rtol=0,atol=.001)
    h=np.array([[r['log_h'][k] for k in frozen['methods']] for r in rows])
    np.testing.assert_allclose(h,frozen['locked_log_forecasts'],rtol=0,atol=2.e-9)
    import score_plate,independent_check
    result=score_plate.run(pred,directory/'author-uploaded-paper.pdf')
    scored=work/'scored.json';scored.write_text(json.dumps(result,allow_nan=False))
    np.testing.assert_allclose(result['plot']['green_mm'],frozen['published_green_mm'],atol=.000003,rtol=0)
    np.testing.assert_allclose(result['plot']['black_mm'],frozen['black_mm'],atol=.000001,rtol=0)
    assert set(result['scores'])==set(frozen['scores']) and len(result['scores'])==14
    for k,m in result['scores'].items():
        for field,value in m.items():
            np.testing.assert_allclose(value,frozen['scores'][k][field],rtol=0,atol=.000003)
        for name,rec in result['spatial'][k].items():
            assert rec['worst_i']==frozen['worst'][k][name]['worst_i']
    assert result['gates']==frozen['gates'] and not result['all_pass']
    checks=independent_check.verify(directory,pred,scored,work/'independent.json')
    assert {str(v['i']):v['raw_trace_sha256'] for v in checks['raw_worst_cells']}==frozen['raw_sha256']
    print(f"Reconstructed {len(rows)} traces, {len(rows)*3} measured peak estimates, {len(rows)*len(frozen['methods'])} wave predictions, 301 original green points, 3 black plateau levels and {len(result['scores'])} method scores.")
    print('Independent worst waveforms',checks['raw_worst_positions'],'direct DFT difference (Hz)',checks['max_direct_peak_disagreement_Hz'])
    print('Caliper levels (mm)',result['plot']['black_mm'])
    print('All gates',result['gates'])
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--data-dir',type=Path,required=True)
    ap.add_argument('--work-dir',type=Path);args=ap.parse_args()
    if args.work_dir is not None:replay(args.data_dir,args.work_dir)
    else:
        with tempfile.TemporaryDirectory() as t:replay(args.data_dir,Path(t))
