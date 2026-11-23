"""Recompute the full comparison on an authenticated copy of the author's thesis."""
import json,hashlib,os,subprocess,sys,tempfile,zipfile
from pathlib import Path
from score_course import report
from table_roles import SRC
HERE=Path(__file__).resolve().parent
def main():
    pdf=Path(sys.argv[1]).resolve()
    assert hashlib.sha256(pdf.read_bytes()).hexdigest()==SRC
    expected=json.loads((HERE/'comparison.json').read_text())
    old=os.getcwd()
    with tempfile.TemporaryDirectory() as work:
        try:
            os.chdir(work)
            def run(n,*args):
                subprocess.run([sys.executable,str(HERE/n),*map(str,args)],check=True)
            run('table_roles.py',pdf);p='projected-calibration-and-inputs.json'
            assert hashlib.sha256(Path(p).read_bytes()).hexdigest()=='6cf65ba575657d46bbbb2ce22ff3819563966b4b34285d05ce15a12f1ac88663'
            run('envelopes.py',p);run('check_iast.py',p)
            Path('runtime.json').write_text(json.dumps(dict(source='c7f97de062717a8db38bd1f633d53ad665518170')))
            lock=Path('local-lock.zip')
            with zipfile.ZipFile(lock,'w') as z:
                for n in ['predictions.json','source-diagnostics.json','runtime.json']:z.write(n,n)
            result=report(pdf,lock,hashlib.sha256(lock.read_bytes()).hexdigest())
            assert result['gates']==expected['gates']
            delta=0.
            for k,d in result['arms'].items():
                e=expected['arms'][k]
                delta=max(delta,max(abs(x-y) for x,y in zip(d['block_maes'],e['block_maes'])))
                assert d['worst']['gas']==e['worst']['gas'] and d['worst']['row']['row']==e['worst']['row']['row']
            assert delta<2e-5,delta
            for k,d in result['intervals'].items():assert d['hit_cells']==expected['intervals'][k]['hit_cells']
            print('REPLAY 63 condition scores, 12 gates, 162 interval memberships; maximum condition-score difference',delta)
        finally:os.chdir(old)
if __name__=='__main__':main()
