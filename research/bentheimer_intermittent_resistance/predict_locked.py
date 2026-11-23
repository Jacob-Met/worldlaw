"""Read high-rate image summaries and low-rate calibration, then seal forecasts."""
import argparse
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from occupancy_model import build

XML = "edd1a164af3632201c114d4b5845599ef2783da1d19a4f07223fb6c656e2513f"
LOW = "9c807c6e34f8c1e9cfee0a2c627c6f6bc71b7b716636f7eade1d85a0ce83f6db"

def text(element):
    return " ".join("".join(element.itertext()).split())

def produce(path,source_bytes):
    if hashlib.sha256(source_bytes).hexdigest()!=LOW:
        raise ValueError("source calibration archive mismatch")
    low=json.loads(source_bytes)["low_source_only"]
    data=path.read_bytes()
    if hashlib.sha256(data).hexdigest()!=XML:
        raise ValueError("publisher manuscript identity mismatch")
    root=ET.fromstring(data)
    tabs=[t for t in root.findall(".//table-wrap") if text(t.find("label"))=="Table 1"]
    if len(tabs)!=1:
        raise ValueError("unique processed imaging table required")
    high=[]
    for tr in tabs[0].findall(".//tbody/tr"):
        cells=[text(c) for c in tr]
        if len(cells)!=9:
            raise ValueError("unexpected image-table row")
        high.append(dict(zip(("fw","oil","intermittent","water","Sw","conn_union","conn_stable"),[cells[0],*cells[3:]])))
    return {"whole_source_sha256":XML,"input_boundary":"Only Table1 parsed for high-rate inputs; all high Table2 cells are unopened. Trusted XML parser loaded source bytes in full.",
            "high_imaging_inputs":high,"predictions":build(low,high)}

if __name__=="__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("xml",type=Path)
    parser.add_argument("--out",required=True,type=Path);args=parser.parse_args()
    root=Path(__file__).resolve().parent
    result=produce(args.xml,(root/"low-rate-calibration.json").read_bytes())
    packet=(json.dumps(result,sort_keys=True,indent=2,allow_nan=False)+"\n").encode()
    args.out.write_bytes(packet)
    print(json.dumps({"rows":len(result["predictions"]),"roles":len(result["predictions"][0]["values"]),
                      "bytes":len(packet),"sha256":hashlib.sha256(packet).hexdigest()}))
