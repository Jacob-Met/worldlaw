"""Replay the MeshRIR forecasts and independently recount the locked held outcomes."""
import argparse
import hashlib
import json
from pathlib import Path
import tempfile
import urllib.request
import sys
import subprocess
import zlib
import numpy as np
from forecast import forecast
from outcome import evaluation
from independent import compare
from acquisition import acquisition
from worst_trace import verify_worst_trace

ROOT=Path(__file__).resolve().parent
SOURCE="https://zenodo.org/records/10852693/files/S1-M3969_npy.zip?download=1"

def run(archive):
    with tempfile.TemporaryDirectory(prefix="worldlaw-meshrir-") as temporary:
        p=Path(temporary)
        if archive is None:
            archive=p/"S1-M3969_npy.zip"
            with urllib.request.urlopen(SOURCE,timeout=180) as response, archive.open("xb") as dest:
                while block:=response.read(2**20):
                    dest.write(block)
        subprocess.run([sys.executable, str(ROOT/"resonance.py")], check=True)
        expected=json.loads((ROOT/"archive-digests.json").read_text())
        for name in ("bank","outcome"):
            compressed=(ROOT/(name+".json.zlib")).read_bytes()
            assert hashlib.sha256(compressed).hexdigest()==expected[name]["compressed_sha256"]
            raw=zlib.decompress(compressed)
            assert hashlib.sha256(raw).hexdigest()==expected[name]["sha256"]
            (p/(name+".json")).write_bytes(raw)
        settings=acquisition(archive)
        assert settings["cube_min_median_max_s"]==[4811,4916,4944]
        assert settings["temperature_range"]==[26.2,26.3] and settings["seconds"]==20928
        forecast(archive,p/"fresh.json")
        basis=json.loads((p/"bank.json").read_bytes())
        fresh=json.loads((p/"fresh.json").read_bytes())
        assert basis["held_centers"]==fresh["held_centers"] and basis["donor_ids"]==fresh["donor_ids"]
        assert basis["arms"]==fresh["arms"] and basis["frequencies"]==fresh["frequencies"]
        for arm in basis["arms"]:
            np.testing.assert_allclose(fresh["forecasts"][arm],basis["forecasts"][arm],rtol=1e-7,atol=1e-9)
        evaluation(archive,p/"bank.json",expected["bank"]["sha256"],p/"recount.json")
        delivered=json.loads((p/"outcome.json").read_bytes())
        result=json.loads((p/"recount.json").read_bytes())
        assert result["gates"]==delivered["gates"] and result["joint"]==delivered["joint"]
        for arm in basis["arms"]:
            for layer in ("all","lower","upper"):
                np.testing.assert_allclose(result["metrics"][arm][layer]["per_frequency"],
                    delivered["metrics"][arm][layer]["per_frequency"],rtol=1e-8,atol=1e-10)
        compare(archive,p/"bank.json",p/"outcome.json")
        saved=json.loads((ROOT/"independent-receipt.json").read_bytes())
        verify_worst_trace(archive,basis,delivered,saved["raw_worst"])
        print("REPLAY",len(basis["held_centers"]),"centers,",len(basis["arms"]),"arms; registered joint",delivered["joint"])

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--archive",type=Path)
    run(parser.parse_args().archive)
