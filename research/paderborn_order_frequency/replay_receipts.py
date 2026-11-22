"""Verify the released estimator and source-clock receipts using standard Python."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
PROTOCOL = '86a79d999e515483f67aa28cc5f277d2d6c009f6039a87ec9cf6dfddfa2fefd8'


def retained(name, expected, prefix=None):
    raw = (HERE / name).read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError('Changed original receipt ' + name)
    if prefix:
        matches = [line[len(prefix):] for line in raw.decode().splitlines() if line.startswith(prefix)]
        if len(matches) != 1:
            raise ValueError('Missing or duplicated receipt record')
        return json.loads(matches[0])
    return raw


def main():
    protocol = json.loads(retained('protocol.json', PROTOCOL))
    for name, sha in protocol['source_hashes'].items():
        retained(name, sha)
    first = retained('native-w512-original.txt','c76e2fa4210d13b4b0f9883db0aea5c7dd7df8fd8ca1f50530b62d8dd3bc8d3a','FULL_MATRIX ')
    assert first == json.loads((HERE/'native-w512-result.json').read_text())
    assert first['actual_native_center0'] == 255 and first['scipy_center0'] == 256
    stock = [r for r in first['runs'] if r['mode']=='existing-scipy']
    assert len(stock) == 3 and all(not row['complex_pass'] and not row['grid_pass'] for row in stock)
    assert next(r for r in stock if r['frames']==4900)['native_complex_shape'] == [257,2451]
    assert next(r for r in stock if r['frames']==4900)['receiver_complex_shape'] == [257,2450]

    deployment = retained('native-v4-production-gate.txt','fc260d78a1f129014867d3f605aedc333bf8d7bbf2b65f868fbcc20065aa5d96','PRODUCTION_GATE ')
    assert deployment['physical_measurements_opened'] == 0 and deployment['protocol_sha256'] == PROTOCOL
    runs = deployment['runs']
    assert [r['frames'] for r in runs] == [5111,5112,4900]
    assert sum(r['all_complex_cells'] for r in runs) == 1943948
    assert sum(r['all_grid_cells'] for r in runs) == 987651
    worst = max(r[k] for r in runs for k in ('max_complex_relative_to_peak','max_grid_relative_to_peak','max_dc_relative_to_peak'))
    assert worst < 1e-10
    refusal = retained('K001-original.txt','fc69c26d168568829bcffdf75c706216be225c798a534b9353cff32aeb56fc67').decode()
    diagnostic = retained('K001-first-clock-native.txt','ef7703a3a39b9f4b7db511b9939500506d23518bf9cb76db924a327e806ae90e','CLOCK_DIAGNOSIS ')
    assert diagnostic == json.loads((HERE/'K001-first-clock.json').read_text())
    registry = json.loads((HERE/'independent-archive-lock.json').read_text())
    K001 = next(row for row in registry['files'] if row['name']=='K001.rar')
    assert K001['sha256'] == diagnostic['whole_K001_sha256']
    assert diagnostic['first_matching_member']=='N15_M07_F10_K001_20.mat'
    assert diagnostic['complete_unit_product_exists'] is False
    assert diagnostic['eligible_mat_materialized']==1 and diagnostic['spectra_computed_by_diagnostic']==0
    assert diagnostic['other_bearings_opened']==0
    logs = retained('K001-source-log-native.txt','b827ea2610011686276b46cca5ab7f4f1e446ae716a7aedec89ed465705300e0','SOURCE_LOGS ')
    assert logs['extra_scientific_mat_members_read'] == 0
    assert next(r for r in logs['pdfs'] if r['name'].endswith('measuring_log_K001.pdf'))['sha256']=='827f5ae9eec40ed96b2078fc4529bf0f07f4ffe063fceeb2a5a569d1ac809cb2'
    clocks = diagnostic['channel_clock_metadata']
    assert clocks['speed']['time_sha256'] in refusal and 'RC 1' in refusal
    for item in clocks.values():
        assert item['uniform_gate'] is False and item['max_abs_deviation']>item['tolerance']
        assert abs(float(item['actual'])-float(item['affine'])-item['max_abs_deviation']) < 1e-15
        assert abs(item['max_abs_deviation']*item['median_rate']-item['deviation_samples']) < 1e-12
    print(json.dumps({'native_deployment_worst_relative_to_peak':worst,
                      'native_complex_values':1943948,'registered_grid_values':987651,
                      'first_healthy_mat':diagnostic['first_matching_member'],
                      'speed_max_deviation_samples':clocks['speed']['deviation_samples'],
                      'vibration_max_deviation_samples':clocks['vibration_1']['deviation_samples'],
                      'physical_surfaces_completed_before_refusal':0,'held_bearings_scored':0},sort_keys=True))


if __name__=='__main__':
    main()
