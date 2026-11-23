"""Read Table 11 capacity columns only after authenticating a complete original forecast."""
import hashlib, json, sys, zipfile
from pathlib import Path
import numpy as np
from table_roles import SRC, NAMES, column, held_inputs
ROSTER = ['site_midrange', 'author_toth_iast', 'refit_pure_iast', 'binary_additive_iast', 'binary_logratio_iast', 'site_minimax_vertex', 'independent_site_affinities']

def receive(pdf, archive, digest):
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == digest
    assert hashlib.sha256(pdf.read_bytes()).hexdigest() == SRC
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        f=json.loads(z.read('predictions.json'))
        s=json.loads(z.read('source-diagnostics.json'))
        r=json.loads(z.read('runtime.json'))
        assert r['source']=='c7f97de062717a8db38bd1f633d53ad665518170'
    assert f['arms']==ROSTER and f['observed_ternary_capacity_columns_used']==0
    assert [v['row'] for v in f['forecasts']]==held_inputs(pdf)
    p=np.array([v['predictions'] for v in f['forecasts']])
    lo=np.array([v['lo'] for v in f['forecasts']]); hi=np.array([v['hi'] for v in f['forecasts']])
    assert p.shape==(27,7,3) and np.isfinite(p).all()
    assert lo.shape==hi.shape==(27,3) and np.isfinite(lo).all() and np.isfinite(hi).all() and (hi+1e-7>=lo).all()
    assert s['all_27_pure_toth_iast_spreading_relative_error']<2e-6
    assert s['max_total_loading_absolute_error']<2e-7
    return f,s,p,lo,hi

def report(pdf,archive,digest):
    f,s,p,lo,hi=receive(pdf,archive,digest)
    values=[list(map(float,column(pdf,x,width))) for x,width in [(180,38),(225,38),(315,40),(360,42),(450,42),(495,42)]]
    assert [len(c) for c in values]==[27]*6
    q=np.array(values[::2]).T; u=np.array(values[1::2]).T
    assert np.isfinite(q).all() and np.isfinite(u).all() and (u>=0).all()
    rows=[v['row'] for v in f['forecasts']]
    errors=p-q[:,None,:]; absolute=abs(errors); groups=absolute.reshape(9,3,7,3).mean(axis=(1,3))
    means=groups.mean(axis=0);worst=groups.max(axis=0)
    bands=np.array([s['calibration_bands'][str(row['T'])]['author_band_halfwidth'] for row in rows])
    def envelope(a,b):
        hit=(q>=a)&(q<=b)
        missed=np.maximum(0,np.maximum(a-q,q-b)); ii,jj=np.unravel_index(np.argmax(missed),q.shape)
        return dict(hits=int(hit.sum()),by_gas=hit.sum(axis=0).tolist(),by_block=hit.reshape(9,9).sum(axis=1).tolist(),all_nine_per_block=hit.reshape(9,9).all(axis=1).tolist(),mean_width=float((b-a).mean()),maximum_width=float((b-a).max()),hit_cells=hit.tolist(),widths=(b-a).tolist(),largest_outside_distance=float(missed[ii,jj]),worst=dict(row=rows[ii],species=NAMES[jj],q=float(q[ii,jj]),lo=float(a[ii,jj]),hi=float(b[ii,jj])))
    arms={}
    for k,name in enumerate(ROSTER):
        col=absolute[:,k,:]; i,j=np.unravel_index(np.argmax(col),col.shape)
        arms[name]=dict(equal_block_mean=float(means[k]),worst_block=float(worst[k]),block_maes=groups[:,k].tolist(),by_gas=col.mean(axis=0).tolist(),by_temperature=col.reshape(3,9,3).mean(axis=(1,2)).tolist(),middle_pressure_mae=float(col[[r['pressure_group']==500 for r in rows]].mean()),all_N2_rows=errors[:,k,1].tolist(),worst=dict(row=rows[i],gas=NAMES[j],q=float(q[i,j]),u=float(u[i,j]),forecast=float(p[i,k,j]),absolute=float(col[i,j]),all_three_observed=q[i].tolist(),all_three_predicted=p[i,k].tolist()))
    gates={name:{'mean':bool(means[0]<means[k]),'worst':bool(worst[0]<worst[k])} for k,name in enumerate(ROSTER) if k}
    result=dict(source_sha256=SRC,forecast_sha256=digest,original_row_order=rows,observed=q.tolist(),reported_uncertainties=u.tolist(),arms=arms,gates=gates,primary_passed=all(all(a.values()) for a in gates.values()),intervals=dict(site=envelope(lo,hi),author=envelope(p[:,1]-bands,p[:,1]+bands)),signed_residuals=errors.tolist())
    return result

if __name__=='__main__':
    r=report(Path(sys.argv[1]),Path(sys.argv[2]),sys.argv[3]);Path('score.json').write_text(json.dumps(r,sort_keys=True,separators=(',',':')))
    print('COMPLETE',r['primary_passed'],r['gates'])
    print('ARM_SCORES',[(k,v['equal_block_mean'],v['worst_block']) for k,v in r['arms'].items()])
    print('INTERVALS',[(k,v['hits'],v['mean_width']) for k,v in r['intervals'].items()])
    print('WORST',r['arms']['site_midrange']['worst'])
