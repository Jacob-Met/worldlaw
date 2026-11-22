"""Qualify nominal KTC measurement geometry and the submitted method's asset links."""
import hashlib
import io
import json
import urllib.request
from itertools import chain
from urllib.error import HTTPError, URLError

import numpy as np
from scipy.io import loadmat, whosmat


PIN = "5f0b13f807d3482e964f236ada6e86b5c66477f5"
REF_BLOB = "712400865cb405d88730144db2f4774a0dcaac0c"
BASE = "https://raw.githubusercontent.com/alexdenker/ktc2023_postprocessing/" + PIN + "/"
ASSETS = {
    "checkpoint_directory": "https://seafile.zfn.uni-bremen.de/d/faaf3799e6e247198a23/",
    "matrices_directory": "https://seafile.zfn.uni-bremen.de/d/9108bc95b2e84cd285f8/",
}


def signed_pairs(matrix):
    assert matrix.shape[0] == 32
    result = []
    for col in matrix.T:
        idx = np.flatnonzero(col)
        assert len(idx) == 2, len(idx)
        i, j = idx
        assert col[i] == -col[j] and np.isreal(col[i])
        result.append((int(i), int(j)) if col[i] > 0 else (int(j), int(i)))
    return result


def inner(pair_a, pair_b, removed=0):
    i, j = pair_a
    k, l = pair_b
    return int(i == k and i >= removed) + int(j == l and j >= removed) - int(i == l and i >= removed) - int(j == k and j >= removed)


def dot_projected_times_k(u, v, removed):
    k = 32 - removed
    balance_u = int(u[0] >= removed) - int(u[1] >= removed)
    balance_v = int(v[0] >= removed) - int(v[1] >= removed)
    return k * inner(u, v, removed) - balance_u * balance_v


def span_rank(edges):
    vertices = set(chain.from_iterable(edges))
    reached = {next(iter(vertices))}
    while True:
        expanded = reached | {v for e in edges if reached.intersection(e) for v in e}
        if expanded == reached:
            assert reached == vertices
            return len(vertices) - 1
        reached = expanded


def certificate(currents, voltages):
    rows = []
    expected = [2356, 1624, 1404, 1200, 1012, 630, 513]
    for level, n_kept in enumerate(expected, 1):
        removed = 2 * (level - 1)
        k = 32 - removed
        u_kept = [u for u in currents if min(u) >= removed]
        v_kept = [v for v in voltages if min(v) >= removed]
        assert len(u_kept) * len(v_kept) == n_kept
        p, q = span_rank(u_kept), span_rank(v_kept)
        assert q == k - 1 and set(chain.from_iterable(u_kept)) <= set(chain.from_iterable(v_kept))
        min_num = None
        identifiable = 0
        for u in currents:
            for v in voltages:
                if min(*u, *v) >= removed:
                    continue
                # k²/2 times ||A - PAP||_F², A = uvᵀ + vuᵀ, P the
                # orthogonal projector onto zero-sum vectors on retained contacts.
                num = k*k*(inner(u, u)*inner(v, v) + inner(u, v)**2)
                num -= dot_projected_times_k(u, u, removed)*dot_projected_times_k(v, v, removed)
                num -= dot_projected_times_k(u, v, removed)**2
                assert num >= 0
                identifiable += num == 0
                min_num = num if min_num is None else min(min_num, num)
        rows.append(dict(level=level, removed=removed, retained=n_kept,
                         omitted=2356-n_kept, injection_rank=p, sensing_rank=q,
                         general_rank=p*q, reciprocal_rank=p*q-p*(p-1)//2,
                         nonzero_witnesses=2356-n_kept-identifiable,
                         min_positive_integer_witness=min_num))
        assert identifiable == 0
    return rows


def link_status(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "KTC-geometry-source/1.0"})
        with urllib.request.urlopen(req, timeout=30) as f:
            first = f.read(50000)
            return dict(status=f.status, content_type=f.headers.get_content_type(),
                        bytes_read=len(first), prefix_sha256=hashlib.sha256(first).hexdigest(),
                        final_host=urllib.parse.urlparse(f.url).netloc,
                        title=" ".join(first.decode(errors="replace").partition("<title>")[2].partition("</title>")[0].split())[:110])
    except (HTTPError, URLError, TimeoutError) as err:
        return dict(status=getattr(err, "code", None), error=type(err).__name__, message=str(err)[:160])


def main():
    with urllib.request.urlopen(BASE+"ChallengeData/level_1/ref.mat", timeout=30) as f:
        payload = f.read(20000)
    blob = hashlib.sha1(b"blob "+str(len(payload)).encode()+b"\0"+payload).hexdigest()
    assert (len(payload), blob) == (19121, REF_BLOB)
    metadata = whosmat(io.BytesIO(payload))
    ref = loadmat(io.BytesIO(payload), variable_names=["Injref", "Mpat"])
    assert set(ref)-{"__header__", "__version__", "__globals__"} == {"Injref","Mpat"}
    current = signed_pairs(ref["Injref"])
    voltage = signed_pairs(ref["Mpat"])
    assert len(current) == 76 and len(voltage) == 31
    assert {tuple(sorted(v)) for v in voltage} == {(i,i+1) for i in range(31)}
    assert {i for u in current for i in u} == set(range(0,32,2))
    print(json.dumps(dict(schema="p3.ktc2023.nominal-port-identification.v1", source_pin=PIN,
                         design_blob=blob, design_sha256=hashlib.sha256(payload).hexdigest(),
                         declared_mat_fields=metadata, decoded=["Injref","Mpat"],
                         current_signed_entries=np.unique(ref["Injref"]).tolist(),
                         voltage_pattern_signed_entries=np.unique(ref["Mpat"]).tolist(),
                         levels=certificate(current,voltage),
                         target_measurements_decoded=0, photo_masks_decoded=0,
                         links={n:link_status(url) for n,url in ASSETS.items()}), sort_keys=True))


if __name__ == "__main__":
    main()
