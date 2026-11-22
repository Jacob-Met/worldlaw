"""Pandas recount of operating-flow bins with an unavailable published inlet."""
import calendar
import json
from zipfile import ZipFile
import numpy as np
import pandas as pd


def measure(raw_path, prepared_path):
    wells = [13, 26, 29, 33, 35]
    keys = [str(w) for w in wells]
    longest = {key: {'bins': 0} for key in keys}
    ongoing = {key: None for key in keys}
    totals = dict.fromkeys(keys, 0)
    examples, by_month = {}, {}
    flow = [f'Probe_{w:02d}_V_dot' for w in wells]
    inlets = [f'Probe_{w:02d}_T_in' for w in wells]
    def member_names(archive):
        return sorted(n for n in archive.namelist() if n.endswith('.csv'))
    with ZipFile(raw_path) as raw, ZipFile(prepared_path) as prepared:
        for a, b in zip(member_names(raw), member_names(prepared), strict=True):
            ym = a[-11:-4]
            assert b[-11:-4] == ym
            with raw.open(a) as stream:
                readings = pd.read_csv(stream, usecols=['Time', *flow], dtype={c:'float64' for c in flow})
            with prepared.open(b) as stream:
                tokens = pd.read_csv(stream, usecols=['Time', *inlets], dtype=str, keep_default_na=False)
            readings = readings.set_index(pd.to_datetime(readings.pop('Time'), utc=True))
            tokens = tokens.set_index(pd.to_datetime(tokens.pop('Time'), utc=True))
            count = readings.resample('5min').count()
            active = (readings >= .5).resample('5min').max()
            negative = (readings < 0).resample('5min').max()
            y, m = map(int, ym.split('_'))
            base = pd.Timestamp(f'{y}-{m:02d}-01', tz='UTC')
            grid = pd.date_range(base, periods=calendar.monthrange(y,m)[1]*288, freq='5min')
            tokens = tokens.reindex(grid, fill_value='')
            by_month[ym] = {}
            for key, channel, inlet in zip(keys, flow, inlets, strict=True):
                eligible = (count[channel].reindex(grid) == 10) & active[channel].reindex(grid).eq(True)
                eligible &= negative[channel].reindex(grid).eq(False)
                missing = tokens[inlet].str.lower().isin(['', 'nan', 'na', 'null', 'inf', '-inf'])
                bad = (eligible & missing).to_numpy(bool)
                by_month[ym][key] = int(bad.sum())
                totals[key] += int(bad.sum())
                transitions = np.flatnonzero(np.diff(np.r_[False, bad, False])).reshape(-1,2)
                prior, ongoing[key] = ongoing[key], None
                for lo, hi in transitions:
                    first, last, length = grid[int(lo)], grid[int(hi)-1], int(hi-lo)
                    if lo == 0 and prior and prior['end'] + pd.Timedelta(minutes=5) == first:
                        first, length = prior['start'], length + prior['bins']
                    if length > longest[key]['bins']:
                        longest[key] = {'bins':length, 'start':first.isoformat(), 'end':last.isoformat()}
                    if hi == len(bad):
                        ongoing[key] = {'bins':length, 'start':first, 'end':last}
                    if key not in examples and first >= pd.Timestamp('2021-07-01', tz='UTC'):
                        examples[key] = {'label':first.isoformat(), 'issued_at':first.floor('D').isoformat(),
                                         'raw_30s_slots':10, 'flow_rule':'at least one >=0.5, all finite and nonnegative',
                                         'prepared_inlet_present':False}
    return {'by_month':by_month, 'by_well':totals,
            'longest_unbroken_qualifying_bins':longest, 'examples':examples}
