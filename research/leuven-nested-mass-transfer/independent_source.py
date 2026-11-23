"""Cold audit of source forecasts and the common unavailable-bin fallback."""
import hashlib, io, json, sys, zipfile
import numpy as np

def array(d):
    return np.array([complex(*v) for v in d['entries']]).reshape(d['shape'])

def check(path):
    with zipfile.ZipFile(path) as z:
        raw=z.read('forecasts.npy')
        y=np.load(io.BytesIO(raw),allow_pickle=False)
        mask=np.load(io.BytesIO(z.read('source_admission.npy')),allow_pickle=False)
        r=json.loads(z.read('source_report.json'))
    assert y.shape==(4,8,13,8192) and mask.shape==(4,8192)
    assert np.isfinite(y).all() and hashlib.sha256(raw).hexdigest()==r['forecast_sha256']
    q=[[int(sum(row[i:i+2048])) for i in range(0,8192,2048)] for row in mask]
    assert q==r['quarter_counts']
    for i,counts in enumerate(r['counts']):
        assert sum(counts.values())==8192 and counts.get('admitted',0)==sum(q[i])
        assert np.all((y[i]-y[i,1])[:,:,~mask[i]]==0)
    passed=all(sum(b)>=4096 and min(b)>=512 for b in q)
    assert passed==r['source_only_gate']
    sw=r['source_worst']
    w=sw['weakest_calibration_field']
    field=array(w['healthy_field'])[:6];v=array(w['weak_site_vector'])
    s=w['singular_values']
    err=abs(np.linalg.norm(field@v)-s[-1])/max(s[0],1e-300)
    assert err<1e-10 and abs(np.linalg.norm(v)-1)<1e-9
    worst={'field':[w['hz'],s[0],s[-1],float(err)]}
    for k in ['largest_changed_reciprocity_defect','largest_healthy_reciprocity_defect']:
        if k not in sw:continue
        h=sw[k]
        a=array(h['changed_difference']) if 'changed_difference' in h else array(h['healthy_ports'])/array(h['gain'])
        defect=np.sqrt(np.sum(abs(a-a.T)**2)/np.sum(abs(a)**2))
        assert abs(defect-h['severity'])<1e-10
        i,j=np.unravel_index(np.argmax(abs(a-a.T)),a.shape)
        worst[k]=[h['hz'],float(defect),int(i),int(j),[float(a[i,j].real),float(a[i,j].imag)],[float(a[j,i].real),float(a[j,i].imag)]]
    return dict(admitted=passed,quarter_counts=q,components=int(y.size),worst=worst,smaller_state_response_files_opened=0)

if __name__=='__main__': print(json.dumps(check(sys.argv[1]),sort_keys=True))
