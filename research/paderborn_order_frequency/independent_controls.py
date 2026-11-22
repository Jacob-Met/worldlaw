"""Reconstruct fourteen preregistered algebraic controls from staged surfaces only."""
import hashlib
import json
import numpy as np


def training_reference(root, protocol, lock):
    high = 'N15_M07_F10'
    low = 'N09_M07_F10'
    result = {}
    for group in ('healthy', 'development'):
        for ident in protocol[group]:
            path = root / 'development' / (ident + '.npz')
            with path.open('rb') as f:
                if hashlib.file_digest(f, 'sha256').hexdigest() != lock['training_arrays'][ident]:
                    raise ValueError('Training input changed for ' + ident)
            with np.load(path, allow_pickle=False) as z:
                receipt = json.loads(z['receipt'].item())
                if receipt['id'] != ident or receipt['stage'] != 'development' or set(receipt['conditions']) != {high, low}:
                    raise ValueError('Incorrect training input role')
                if group == 'healthy':
                    terms = {'healthy_hi': z[high+'_surface'], 'healthy_lo': z[low+'_surface'],
                             'psd_hi': z[high+'_psd'], 'psd_lo': z[low+'_psd']}
                else:
                    h = z[high+'_surface'].astype(np.longdouble)
                    l = z[low+'_surface'].astype(np.longdouble)
                    terms = {'damage_lo': l, 'damage_delta': l-h}
                for name, arr in terms.items():
                    if name not in result:
                        result[name] = np.zeros(arr.shape, dtype=np.longdouble)
                    result[name] += arr.astype(np.longdouble)
        for name in terms:
            result[name] /= len(protocol[group])
    return result


def interpolate_surface(grid, center_hz, order, fallback):
    # Native stored array grid is 125 Hz by a step of one sixty-fourth of an order.
    fi, qi = np.broadcast_arrays(center_hz / 125, order * 64)
    valid = (fi >= 0) & (fi <= grid.shape[0]-1) & (qi >= 0) & (qi <= grid.shape[1]-1)
    fi = np.clip(fi, 0, grid.shape[0]-1)
    qi = np.clip(qi, 0, grid.shape[1]-1)
    f0, q0 = fi.astype(np.intp), qi.astype(np.intp)
    f1, q1 = np.minimum(f0+1, grid.shape[0]-1), np.minimum(q0+1, grid.shape[1]-1)
    fx, qx = fi-f0, qi-q0
    lower = grid[f0,q0]*(1-qx) + grid[f0,q1]*qx
    upper = grid[f1,q0]*(1-qx) + grid[f1,q1]*qx
    return np.where(valid, lower*(1-fx) + upper*fx, fallback)


def power_at(psd, hz, floor):
    idx = np.clip(hz / 125, 0, len(psd)-1)
    left = idx.astype(np.intp)
    fraction = idx-left
    right = np.minimum(left+1, len(psd)-1)
    return np.maximum((1-fraction)*psd[left] + fraction*psd[right], floor)


def control_surfaces(source, high_turns, ref):
    center = np.arange(257, dtype=np.longdouble)[:,None]*125
    order = np.arange(1281, dtype=np.longdouble)[None,:]/64
    low_turns = 15
    ratio = high_turns/low_turns
    hi, lo = ref['psd_hi'], ref['psd_lo']
    floor = hi.mean()*np.longdouble(1e-6)
    healthy = ref['healthy_lo']
    # The two measured source/target pairs have distinct sideband offsets.
    hi_product = power_at(hi, center-order*high_turns/2, floor)*power_at(hi, center+order*high_turns/2, floor)
    lo_product = power_at(lo, center-order*low_turns/2, floor)*power_at(lo, center+order*low_turns/2, floor)
    factor = np.sqrt(lo_product/hi_product)
    dilated = interpolate_surface(source,center*ratio,order,healthy)
    return {'mixed_center':source, 'healthy_low':healthy, 'zero':np.zeros_like(source),
            'mixed_same_reported_row':interpolate_surface(source,center+order*(high_turns-low_turns)/2,order,healthy),
            'unchanged_hz':interpolate_surface(source,center,order/ratio,healthy),
            'uniform_order':dilated,'uniform_order_density':np.where(center*ratio<=32000,ratio*dilated,healthy),
            'additive_healthy':np.maximum(0,source+healthy-ref['healthy_hi']),
            'scalar_gain':source*(lo.mean()/hi.mean()),
            'carrier_gain':source*power_at(lo,center,floor)/power_at(hi,center,floor),
            'sideband_gain':source*factor,'inverse_sideband':source/factor,
            'mean_damaged_low':ref['damage_lo'],'paired_damaged_offset':np.maximum(0,source+ref['damage_delta'])}
