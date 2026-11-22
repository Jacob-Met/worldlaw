"""Reproduce the six development input gates without opening a low-angle image."""
import argparse
import hashlib
import json
from pathlib import Path
import tempfile
import urllib.request
import numpy as np

from qualify_power import evaluate
from independent_power import run as independent_recount
from design_ceiling import evaluate as finite_grid

HERE=Path(__file__).resolve().parent


def read_json(name):
    return json.loads((HERE/name).read_text())


def obtain_folder(directory, rows, fetch):
    for row in rows:
        item=row['file']
        if item['folder'] not in ('Phantom/Commercial_1','Phantom/Prototype_1') or not item['name'].startswith('vfagre3_vfa'):
            raise ValueError('Only six development phantom acquisitions are supported')
        path=directory/(str(item['id'])+'.mat')
        if not path.exists() and fetch:
            req=urllib.request.Request('https://ndownloader.figshare.com/files/'+str(item['id']),headers={'User-Agent':'phantom-source-replay'})
            with urllib.request.urlopen(req,timeout=120) as remote:
                data=remote.read(item['size']+1)
            if len(data)!=item['size'] or hashlib.sha256(data).hexdigest()!=row['sha256']:
                raise ValueError('Downloaded source identity failed')
            with path.open('xb') as out:
                out.write(data)
        if not path.is_file() or path.stat().st_size!=item['size']:
            raise ValueError(f'Missing {path.name} ({item["name"]})')
        if hashlib.sha256(path.read_bytes()).hexdigest()!=row['sha256']:
            raise ValueError(f'Wrong bytes for {item["name"]}')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sources=parser.add_mutually_exclusive_group(required=True)
    sources.add_argument('--source-dir',type=Path,help='Directory of the six Figshare MAT files named by numeric file ID')
    sources.add_argument('--download-development',action='store_true',help='Download only six development phantom files into temporary storage')
    args=parser.parse_args()
    schema=read_json('mat-structural-receipt.json');expected=read_json('power-development.json')
    rows=[q for q in schema if q['file']['id'] in {r['file']['id'] for r in expected['development']}]
    assert len(schema)==20 and len(rows)==6
    with tempfile.TemporaryDirectory(prefix='phantom-power-source-') as temporary:
        directory=Path(temporary) if args.download_development else args.source_dir
        obtain_folder(directory,rows,args.download_development)
        for row in rows:
            actual=evaluate(directory/(str(row['file']['id'])+'.mat'),row)
            prior=next(r for r in expected['development'] if r['file']['id']==row['file']['id'])
            assert actual['gates']==prior['gates'] and not actual['passed']
            for k in ('corner_power','face_power','face_to_floor','normalizer','median_first_angle_floor_fraction','foreground','source_fit_usable'):
                assert np.allclose(actual[k],prior[k],rtol=5e-10,atol=1e-14),k
        receiver=independent_recount(directory,schema,expected)
        original=read_json('independent-physical-boxes.json')
        for a,b in zip(receiver['all_runs'],original['all_runs'],strict=True):
            assert a['file']==b['file']
            for kind in ('corners','faces'):
                for x,y in zip(a['boxes'][kind],b['boxes'][kind],strict=True):
                    assert x['origin_xy']==y['origin_xy']
                    assert np.allclose(x['mean_power'],y['mean_power'],rtol=5e-10,atol=1e-14)
    design=finite_grid();old=read_json('design-ceiling.json')
    assert design['design_grid_points']==old['design_grid_points']==420
    assert np.isclose(design['worst_low']['max_relative_low_error'],old['worst_low']['max_relative_low_error'],rtol=1e-5)
    print(json.dumps({'all_development_runs':6,'independent_tile_means':receiver['tile_means'],
                      'worst':receiver['worst'],'ideal_design_points':420,'admission':False,
                      'opened_low_angles':0,'opened_external_runs':0},sort_keys=True))


if __name__=='__main__':
    main()
