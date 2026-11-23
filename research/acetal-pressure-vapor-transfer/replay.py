"""Recount the frozen forecast against the authenticated NIST ThermoML release."""
import argparse
import hashlib
import shutil
import tarfile
import tempfile
import urllib.request
from pathlib import Path
from independent import verify

HERE = Path(__file__).resolve().parent
SOURCE = "https://data.nist.gov/od/ds/mds2-2422/ThermoML.v2020-09-30.tgz"
PINS = {
    "archive": "231161b5e443dc1ae0e5da8429d86a88474cb722016e5b790817bb31c58d7ec2",
    "xml": "8b9bb0d793b59d468c75800fc9fcc82f92c3452997c56d973749f47c2bf52ae7",
    "forecast.json": "f9d614b592ace94cde51543493fef08387179a9fa4dfaef89529f0dca5232b97",
    "score.json": "9d500a5de38fc5e6392b6a01dc9fccd2d3e242545c2e9865e7c2a73d99c4101e",
}


def check(path, key):
    with path.open("rb") as stream:
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            digest.update(chunk)
    if digest.hexdigest() != PINS[key]:
        raise ValueError(f"Unexpected content for {key}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xml", type=Path)
    args = parser.parse_args()
    for name in ("forecast.json", "score.json"):
        check(HERE / name, name)
    with tempfile.TemporaryDirectory() as tmp:
        xml = args.xml
        if xml is None:
            packed = Path(tmp) / "release.tgz"
            with urllib.request.urlopen(SOURCE, timeout=180) as src, packed.open("wb") as dest:
                shutil.copyfileobj(src, dest)
            check(packed, "archive")
            xml = Path(tmp) / "measurement.xml"
            with tarfile.open(packed, "r:gz") as tar:
                members = [m for m in tar if m.isfile() and m.name.endswith("je049816w.xml")]
                if len(members) != 1 or members[0].size != 120416:
                    raise ValueError("Unexpected article member")
                with tar.extractfile(members[0]) as src, xml.open("wb") as dest:
                    shutil.copyfileobj(src, dest)
        check(xml, "xml")
        verify(xml, HERE / "forecast.json", HERE / "score.json")


if __name__ == "__main__":
    main()
