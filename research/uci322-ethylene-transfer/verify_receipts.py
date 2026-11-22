"""Verify the published original identities, confounded designs and bounded negative forecast result."""
import hashlib
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
R=HERE/'receipts'


def read(name): return json.loads((R/name).read_text())


def main():
    identities=json.loads((HERE/'receipt-identities.json').read_text())
    for name,expected in identities.items():
        if Path(name).name!=name or hashlib.sha256((R/name).read_bytes()).hexdigest()!=expected:
            raise ValueError(f'Changed scientific receipt {name}')
    score=read('held-scores.json');ind=read('independent-recount.json')
    assert identities['held-scores.json']==ind['source_score']
    assert ind['compared_material_role_strata']==328 and ind['worst_rows']==36 and ind['release_events']==33548
    assert ind['recomputed_native_statistic_fields']==1640 and not ind['joint_pass'] and not score['joint_pass']
    extent=read('original-tensor-custody.json')
    attachments=json.loads((HERE/'original-tensor-attachments.json').read_text())
    assert len(attachments)==10
    for gas,rows,count in [('CO',4208261,16833),('methane',4178504,16715)]:
        record=read('input-only-'+gas+'.json')
        assert identities['input-only-'+gas+'.json']==score['locks'][gas]['json']
        assert record['npz']==score['locks'][gas]['npz']==extent['input-only-'+gas+'.npz']['sha256']
        assert record['native_rows']==rows and record['decision_count']==count
        assert record['numeric_columns_read']==[0,*range(3,19)] and record['setpoint_values_accessible_to_decoders'] is False
        frozen=read('development-'+gas+'.json')
        assert frozen['full_model_sha256']==extent['frozen-model-'+gas+'.npz']['sha256']
        opposite=next(x for x in ('CO','methane') if x!=gas)
        vals=score['held'][gas]['routes'][opposite]
        assert all(vals['mean']['all']['rmse_ppm']<v['all']['rmse_ppm'] for role,v in vals.items() if role!='mean')
    for filename,source in extent.items():
        parts=sorted((r for r in attachments if r['file']==filename),key=lambda q:q['offset'])
        assert sum(v['size'] for v in parts)==source['size'] and len(parts)==len(source['chunks'])
        for part,chunk in zip(parts,source['chunks']):
            assert part['attachment'].startswith('att-')
            assert all(part[k]==chunk[k] for k in ('size','offset','sha256'))
    print('Verified four source/target routes, 36 common-clock forecasts, 328 metric groups, 36 worst rows and ten original tensor extents.')


if __name__=='__main__':main()
