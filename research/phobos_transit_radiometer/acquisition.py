"""Acquire only declared source measurements, evaluation prefixes, and specified clocks."""
import datetime as dt
import hashlib
import math
from urllib.request import Request, urlopen


def authenticated(url, digest):
    with urlopen(Request(url, headers={"User-Agent": "InSight transit archival comparison"}), timeout=60) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != digest:
        raise ValueError("PDS product checksum mismatch")
    return data


def utc(value):
    token = value.decode().strip().strip('"').strip().rstrip("Z")
    try:
        return dt.datetime.fromisoformat(token)
    except ValueError:
        return dt.datetime.strptime(token, "%Y-%jT%H:%M:%S.%f")


def read(protocol, truth=False):
    rad = protocol["radiometer"]
    rows = authenticated(rad["uri"], rad["sha256"]).splitlines()
    events = {}
    for spec in protocol["events"]:
        sol = spec["sol"]
        center = dt.datetime.fromisoformat(spec["utc"])
        early, support, targets = [], [], []
        for row in rows:
            try:
                timestamp = utc(row[:25])
            except ValueError:
                continue
            t = (timestamp-center).total_seconds()
            prefix = -90 <= t <= -25
            scored = -spec["width"]/2 <= t <= 60
            if scored:
                support.append(t)
            if prefix or (scored and (truth or sol == protocol["calibration_sol"])):
                v = float(row[158:166])
                if not 100 < v < 400:
                    raise ValueError(("temperature outside eligible finite range", sol, t))
                (early if prefix else targets).append((t, v))
        assert len(early) >= 25 and len(support) >= 30
        current = []
        if not truth:
            record = authenticated(spec["current_uri"], spec["current_sha256"])
            for row in record.splitlines():
                try:
                    t = (utc(row[15:36]) - center).total_seconds()
                except ValueError:
                    continue
                if not -90 <= t <= spec["width"]/2:
                    continue
                east, west = (v.strip() for v in (row[444:452], row[480:488]))
                if not east or not west:
                    continue
                pair = float(east), float(west)
                if 9999.9 in pair:
                    continue
                assert all(math.isfinite(v) for v in pair)
                current.append((t, sum(pair)/2))
            assert len([t for t, a in current if abs(t) <= spec["width"]/2]) == {"0498":9,"0499":7,"0501":7}[sol]
        events[sol] = dict(spec=spec, early=early, times=support, targets=targets, current=current)
    return events
