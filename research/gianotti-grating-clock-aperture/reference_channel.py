"""Prospective unloaded-reference gate for the fixed raw-channel course."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

import numpy as np

from source_clocks import ARCHIVE_SHA, file_hash, require

CARRIERS = np.array([1551.16, 1560.68, 1569.44])
WAVELENGTH = 1460.0 + 0.008 * np.arange(20000)


def read_first_frame(archive, name):
    """Read one complete 4-channel exposure at its native recorded timestamp."""
    with archive.open(name) as stream:
        axis = {}
        for line in stream:
            row = line.strip()
            for key in ("Wavelength Start (nm)", "Wavelength Delta (nm)", "Number of Points"):
                if row.startswith(key.encode() + b":"):
                    axis[key] = float(row.split(b":", 1)[1].strip().replace(b",", b"."))
            if re.fullmatch(rb"\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}(?:\.\d+)?", row):
                require(axis == {"Wavelength Start (nm)":1460., "Wavelength Delta (nm)":0.008,
                                 "Number of Points":20000.}, "Instrument wavelength axis differs")
                channels = []
                for _ in range(4):
                    fields = stream.readline().strip().split(b"\t")
                    require(len(fields) == len(WAVELENGTH), "Channel sample count differs")
                    values = np.array([float(v.replace(b",", b".")) for v in fields])
                    require(np.isfinite(values).all(), "Nonfinite native word in requested frame")
                    channels.append(values)
                return row.decode("ascii"), np.stack(channels)
    raise ValueError("No complete exposure in the selected member")


def channel_gate(frame):
    require(frame.shape == (4,20000) and np.isfinite(frame).all(), "Unexpected four-channel response")
    contrasts = []
    winners = []
    for center in CARRIERS:
        distance = np.abs(WAVELENGTH-center)
        middle = distance <= 0.75
        flank = (distance >= 1.5) & (distance <= 3.0)
        difference = frame[:, middle].max(axis=1) - np.median(frame[:, flank], axis=1)
        order = np.argsort(difference)
        best, runner = int(order[-1]), int(order[-2])
        strong = difference[best] > max(0., difference[runner]) and difference[best] >= 2*max(0., difference[runner])
        winners.append(best+1 if strong else None)
        contrasts.append(difference.tolist())
    identified = winners[0] is not None and len(set(winners)) == 1
    return {"carriers_nm": CARRIERS.tolist(), "contrast_rows_grating_by_channel": contrasts,
            "winning_channels_one_based": winners, "identified": identified,
            "channel_one_based": winners[0] if identified else None}


def numerical_controls():
    base = np.zeros((4,20000))
    for c in CARRIERS:
        base[2,np.argmin(np.abs(WAVELENGTH-c))] = 15
    require(channel_gate(base)["channel_one_based"] == 3, "Unique three-carrier control failed")
    require(channel_gate(base[[2,0,1,3]])["channel_one_based"] == 1, "Permutation control failed")
    tie = base.copy()
    tie[0] = base[2]
    require(not channel_gate(tie)["identified"], "Tied channel should refuse")
    crossed = base.copy()
    j = np.argmin(np.abs(WAVELENGTH-CARRIERS[-1]))
    crossed[1,j] = 50
    require(not channel_gate(crossed)["identified"], "Crossed carrier identity should refuse")
    return {"unique":True,"permuted":True,"tie_refused":True,"inconsistent_refused":True}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--archive",type=Path)
    p.add_argument("--output",type=Path)
    args=p.parse_args()
    result={"synthetic_controls":numerical_controls(),"loaded_spectra_opened":0,"unloaded_frames_opened":0}
    if args.archive is not None:
        require(file_hash(args.archive)==ARCHIVE_SHA,"Archive hash differs")
        with zipfile.ZipFile(args.archive) as z:
            names=[n for n in z.namelist() if n.startswith("campaign_a/datasources/FBG/0_ref/Responses.")]
            require(len(names)==1,"Reference member differs")
            stamp,reference=read_first_frame(z,names[0])
        result.update(member=names[0],timestamp=stamp,unloaded_frames_opened=1,
                      native_f64_sha256=hashlib.sha256(reference.astype("<f8").tobytes()).hexdigest(),
                      reference_channel=channel_gate(reference))
    txt=json.dumps(result,indent=2,allow_nan=False,sort_keys=True)+"\n"
    if args.output:args.output.write_text(txt)
    print(txt,end="")

if __name__=="__main__":
    main()
