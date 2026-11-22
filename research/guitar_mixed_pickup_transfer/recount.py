"""Independent standard-library receiver for the locked spectra and actual partial observations."""
from collections import defaultdict
from hashlib import sha256
from io import BytesIO
import json
import math
from pathlib import Path
import struct
import zipfile


def digest(b):
    return sha256(b).hexdigest()


def close(x,y):
    if not math.isclose(x,y,abs_tol=1e-9,rel_tol=1e-12):
        raise ValueError((x,y))


def recount(source,forecast_sha,expected_archive_sha):
    root=Path(__file__).resolve().parent
    gate_bytes=(root/'gate.json').read_bytes();assert digest(gate_bytes)=='64de8066e585702b13a91b8eca7db994424fdfa3b7fc85cd1a3f4d296307a94d'
    gate=json.loads(gate_bytes);src=json.loads((root/'source-registration.json').read_bytes())['source']
    for n,h in gate['source_files'].items():assert digest((root/n).read_bytes())==h
    b=source.read_bytes();assert digest(b)==expected_archive_sha
    with zipfile.ZipFile(BytesIO(b)) as z:
        names={'forecast.zip','scores.json'}|{f'observed/{i:02d}.json' for i in range(48)}|{f'source/{m}/{f}' for m in ('stable','early') for f in ('metadata.json','training-mixed.npy','singles.npy')}
        assert len(z.infolist())==len(names) and set(z.namelist())==names
        for meter,entries in gate['input_artifacts'].items():
            for name,(size,h) in entries.items():
                v=z.read('source/'+meter+'/'+name);assert len(v)==size and digest(v)==h
        q=z.read('forecast.zip');assert digest(q)==forecast_sha
        receipt=json.loads(z.read('scores.json'))
        assert receipt['forecast_sha']==forecast_sha
        with zipfile.ZipFile(BytesIO(q)) as f:
            manifest=json.loads(f.read('manifest.json'));roles=manifest['roles'];assert len(set(roles))==len(roles)==14
            cases=[[s,j,p] for s in range(1,7) for j in (2,4,6,8) for p in (4,5)]
            assert manifest['cases']==cases==gate['cases'] and roles==gate['roles'] and manifest['protocol_sha']==digest(gate_bytes)
            want={f'{m}/{r}.f64le' for m in ('stable','early') for r in roles}
            assert len(f.namelist())==29 and set(f.namelist())==want|{'manifest.json'} and set(manifest['members'])==want
            tables={}
            for n,h in manifest['members'].items():
                v=f.read(n);assert digest(v)==h and len(v)==9600
                tables[n]=struct.unpack('<1200d',v)
        outcomes={}
        for meter in ('stable','early'):
            aggregate=defaultdict(lambda:defaultdict(list))
            for i,(s,j,p) in enumerate(cases):
                o=json.loads(z.read(f'observed/{i:02d}.json'));assert o['case']==[s,j,p] and o['forecast']==forecast_sha
                assert o['source_lfs']==src['roster'][f'string-{s}/{j}/{p:02d}.wav']
                met=o['measurements'][meter]['metadata'];assert 0<=met['start']<met['length'] and met['start']+met['window']<=met['length']
                if meter=='stable':assert met['lag_correlation']>=.80 and met['relative_to_greatest_RMS']>=.50 and met['eligible_windows']>=1
                raw=o['measurements'][meter]['magnitude'];mx=max(raw);assert mx>0 and len(raw)==25
                truth=[20*math.log10(max(abs(a)/mx,.001)) for a in raw]
                output=receipt['row_metrics'][meter][i];assert output['case']==[s,j,p]
                w=output['candidate_worst_mode']['mode']-1
                for v,want in zip(truth,o['measurements'][meter]['shape_dB']):close(v,want)
                close(truth[w],output['candidate_worst_mode']['measured_dB'])
                for role in roles:
                    pred=tables[meter+'/'+role+'.f64le'][25*i:25*(i+1)]
                    close(max(pred),0.);assert min(pred)>=-60.000001
                    errors=[a-b for a,b in zip(pred,truth)]
                    rms=math.sqrt(math.fsum(y*y for y in errors)/25);k=max(range(25),key=lambda h:abs(errors[h]))
                    close(rms,output['loss'][role]);assert output['worst_by_role'][role][0]==k+1
                    close(abs(errors[k]),output['worst_by_role'][role][1]);close(pred[w],output['candidate_worst_mode']['all_forecast_dB'][role])
                    if role=='shared_circuit':assert k==w
                    for idx in [('all','all'),('switch',str(p)),('string',str(s)),('position_mm',str(30+20*(j-1)))]:
                        aggregate[idx][role].append(rms)
            means={}
            for idx,arms in aggregate.items():
                label,k=idx
                means[idx]={r:math.fsum(v)/len(v) for r,v in arms.items()}
                official=receipt['group_metrics'][meter][label] if label=='all' else receipt['group_metrics'][meter][label][k]
                for r,value in means[idx].items():close(value,official[r])
            best=min([r for r in roles if r!='shared_circuit'],key=lambda r:means['all','all'][r])
            wins=sum(means['string',str(i)]['shared_circuit']<means['string',str(i)][best] for i in range(1,7))
            sw=all(means['switch',p]['shared_circuit']<means['switch',p][best] for p in ('4','5'))
            allwin=means['all','all']['shared_circuit']<means['all','all'][best]
            outcomes[meter]={'strongest_control':best,'strict_string_wins':wins,'lower_in_both_switches':sw,'mean_strict_win':allwin}
            assert outcomes[meter]==receipt['gates'][meter]
        a=outcomes['stable'];qual=a['mean_strict_win'] and a['lower_in_both_switches'] and a['strict_string_wins']>=4
        assert qual==receipt['joint_pass']
        return {'scored_partial_errors':33600,'per_take_method_scores':1344,'locked_arrays':28,'physical_takes':48,'instrument_count':1,'joint_pass':qual,'gates':outcomes}


if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('archive',type=Path);p.add_argument('--forecast-sha',required=True);p.add_argument('--archive-sha',required=True);a=p.parse_args()
    print(json.dumps(recount(a.archive,a.forecast_sha,a.archive_sha),sort_keys=True))
