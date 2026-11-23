"""Recount the registered source-only gate without opening a strain file."""
import json
import math
import sys
from pathlib import Path
from geometry_replay import reconstruct


def replay(directory):
    def get(n):
        return json.loads((directory/n).read_text())
    p=get("protocol.json")
    r=get("screen-receipt.json")
    geo=reconstruct(p,get("source-metadata.json"))
    bg=r["background"]
    assert len(bg)==18
    for sample in [r["virgo"]]+bg:
        norms=[math.hypot(a,b) for a,b in sample["quadratures"]]
        assert len(norms)==9 and abs(max(norms)-sample["snr"])<1e-12
        assert abs(norms[4]-sample["central_snr"])<1e-12
    assert max(x["snr"] for x in bg)==r["background_max"]
    gates={"livingston_reference":r["fine"]["snr"]>=8,"virgo_response":r["virgo"]["snr"]>=5,
           "exceeds_all_18":r["virgo"]["snr"]>r["background_max"]}
    assert gates==r["gates"] and r["source_gate"]==all(gates.values())
    assert r["Hanford_files_opened"]==r["posterior_files_opened"]==0
    ind=get("independent-receipt.json")
    assert ind["statistics"]==20 and ind["held_files"]==0 and ind["max_SNR_difference"]<1e-7
    return {"source_gate":r["source_gate"],"source_matrix_determinant":geo["determinant"],
            "L1_SNR":r["fine"]["snr"],"V1_SNR":r["virgo"]["snr"],"background_max":r["background_max"],"held_files":0}


if __name__=="__main__":
    print(json.dumps(replay(Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).parent),sort_keys=True))
