"""Recreate the availability census and physical kernel checks from the authors' two releases."""
import argparse
import ast
import hashlib
import io
import json
from pathlib import Path
from datetime import datetime
from collections import Counter
import subprocess
import sys
import tempfile
from urllib.request import urlopen
import zipfile

from contrast import study


FILES = {
    'raw_30s.zip': (12724484, '2e42c8ff48de691d7fcf5d9ae73bf5b6', 604269231),
    'prepared_5min.zip': (12724484, '942e11196a8bafe9d9e7405006269cf4', 49691542),
    'Supplementary_BHE_Data.csv': (12724484, '43030b475c96a86528e3973bf476d166', 1035),
}
BASE = Path(__file__).resolve().parent


def authenticated_file(name, record, md5, size, cache):
    path = cache / Path(name).name
    if not path.exists():
        # Resolve the published API locator so the release's actual filename is preserved.
        with urlopen(f'https://zenodo.org/api/records/{record}', timeout=90) as response:
            metadata = json.load(response)
        spec = next(item for item in metadata['files'] if item['key'] == name)
        assert spec['size'] == size and spec['checksum'] == 'md5:' + md5
        download = spec['links'].get('content') or spec['links']['self']
        with urlopen(download, timeout=120) as stream:
            with tempfile.NamedTemporaryFile(dir=cache, delete=False) as output:
                while block := stream.read(1024 * 1024):
                    output.write(block)
                temporary = Path(output.name)
        try:
            with temporary.open('rb') as handle:
                assert temporary.stat().st_size == size and hashlib.file_digest(handle, 'md5').hexdigest() == md5
            temporary.replace(path)
        finally:
            temporary.unlink(missing_ok=True)
    with path.open('rb') as stream:
        assert path.stat().st_size == size and hashlib.file_digest(stream, 'md5').hexdigest() == md5
    return path


def physical_checks(cache, work, geometry):
    import numpy as np
    with urlopen('https://zenodo.org/api/records/5971257', timeout=90) as response:
        files = json.load(response)['files']
    assert len(files) == 1
    release = authenticated_file(files[0]['key'], 5971257, '1a214c6cbdf73324a22c83960c3666ea', 27308, cache)
    source = work / 'hybrid_source'
    source.mkdir()
    with zipfile.ZipFile(release) as archive:
        for item in archive.namelist():
            if item.endswith('.py'):
                (source / Path(item).name).write_bytes(archive.read(item))
    sys.path.insert(0, str(source))
    import hybrid_model
    import gfunctions
    params_tree = ast.parse((source / 'multiple_BHE_backward.py').read_text())
    assignment = next(node for node in ast.walk(params_tree)
                      if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'BheData' for t in node.targets))
    assert all(isinstance(node, (ast.Dict, ast.Constant, ast.BinOp, ast.Div, ast.Load)) for node in ast.walk(assignment.value))
    params = eval(compile(ast.Expression(assignment.value), '<verified author dictionary>', 'eval'), {'__builtins__': {}}, {})
    contrasts = study(geometry, params, gfunctions)
    xy = np.genfromtxt(io.StringIO(geometry), delimiter=',', skip_header=1)[:, 3:5]
    distances = np.linalg.norm(xy[:, None] - xy[None, :], axis=-1)
    np.fill_diagonal(distances, np.inf)
    i, j = np.unravel_index(np.argmin(distances), distances.shape)
    assert (i+1, j+1) == (3, 8)
    corners = xy[[i, j]]
    steps = 72
    config = {'nz': 5, 'dt_bhe': 60., 'dt_soil': 300., 'nt_part': steps,
              'n_parts': 1, 'error': 1e-5, 'type': 'backward'}
    kernel = gfunctions.g_Matrix(corners[:, 0], corners[:, 1], np.arange(1, steps+1)*300., params)
    def run(amplitude):
        inlet = np.full((2, steps), params['Tundist'])
        inlet[0, 6:24] += amplitude
        flows = np.full((2, steps), params['Qf'])
        flows[:, 36:46] = 0.
        state = hybrid_model.init_BHEs(2, params, 60., 5, 'backward')
        wall = np.full((2, steps), params['Tundist'])
        _, outlet, _ = hybrid_model.calc_sa_sec_U_backw(
            config, kernel, inlet, flows, wall, state, np.full(2, params['Tundist']))
        return np.asarray(outlet, dtype=float)
    base, warm, cold = (run(x) for x in (0., 2., -2.))
    drift = float(np.max(abs(base-params['Tundist'])))
    assert 5e-6 < drift < .0005
    assert np.array_equal(warm[:, :6], base[:, :6]) and np.array_equal(cold[:, :6], base[:, :6])
    assert (warm[0]-base[0]).max() > .1 and (cold[0]-base[0]).min() < -.1
    assert np.max(abs(warm+cold-2*base)) < .001
    return contrasts, drift


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True, help='Directory for the verified author archives.')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    assets = {name: authenticated_file(name, *spec, args.cache) for name, spec in FILES.items()}
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        from support import census, prior_year_failures
        summary = census(assets['raw_30s.zip'], assets['prepared_5min.zip'], work, BASE/'support.cpp')
        frozen = json.loads((BASE/'result.json').read_text())
        packed = json.dumps(summary, sort_keys=True).encode()
        assert hashlib.sha256(packed).hexdigest() == frozen['native_support_sha256']
        eras = {'train':('2018_07','2021_06'), 'development':('2021_07','2022_06'),
                'sealed_mask_only':('2022_07','2024_06'), 'total':('2018_07','2024_06')}
        for name, (start, stop) in eras.items():
            months = [rec for ym,rec in summary.items() if start<=ym<=stop]
            joint = sum((Counter(rec['joint']) for rec in months), Counter())
            expected = frozen['coverage'][name]
            assert len(months) == expected['months']
            assert joint['bins'] == expected['n5min']
            assert joint['all40_optimistic_heat'] == expected['eligible_optimistic']
            assert joint['all40_optimistic_forcing'] == expected['all40_boundary_optimistic']
            assert {str(i):joint[f'wells_known_{i}'] for i in range(41)} == expected['hist_wells_known']
            assert [sum(rec['counts'][w-1]['raw_active_prepared_inlet_missing'] for rec in months)
                    for w in (13,26,29,33,35)] == expected['witnesses']
        from independent import measure
        second = measure(assets['raw_30s.zip'], assets['prepared_5min.zip'])
        assert hashlib.sha256(json.dumps(second,sort_keys=True).encode()).hexdigest() == frozen['fivewell_sha256']
        for month, wells in second['by_month'].items():
            for well, count in wells.items():
                assert summary[month]['counts'][int(well)-1]['raw_active_prepared_inlet_missing'] == count
        assert second['longest_unbroken_qualifying_bins'] == frozen['episodes']
        assert second['examples'] == frozen['examples']
        issues = prior_year_failures(summary, datetime(2021,7,1), datetime(2022,7,1))
        assert len(issues) == 365 and list(issues.items())[0] == ('2021-07-01','2021_06')
        assert list(issues.items())[-1] == ('2022-06-30','2022_05')
        assert hashlib.sha256(json.dumps(issues, sort_keys=True).encode()).hexdigest() == frozen['development_issue_witness_sha256']
        geometry = assets['Supplementary_BHE_Data.csv'].read_text(encoding='utf-8-sig')
        contrasts, drift = physical_checks(args.cache, work, geometry)
        assert contrasts['equal_source_distance_classes'] == {int(k):v for k,v in frozen['contrast']['equal_source_distance_classes'].items()}
        for key, result in contrasts['full_scale_unit_line_load_step_kelvin_per_W_per_m'].items():
            expected = frozen['contrast']['full_scale_unit_line_load_step_kelvin_per_W_per_m'][key]
            import numpy as np
            np.testing.assert_allclose(result['difference'], expected['difference'], rtol=1e-7, atol=1e-12)
        print(json.dumps({'months':len(summary),'native_support_sha256':frozen['native_support_sha256'],
                          'synthetic_uniform_drift_K':drift,'equal_distance_classes':contrasts['equal_source_distance_classes']}))


if __name__ == '__main__':
    main()
