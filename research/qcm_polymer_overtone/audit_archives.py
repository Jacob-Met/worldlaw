"""Audit five locally supplied Zenodo ZIPs without interpreting response values."""
import csv
import hashlib
import io
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path


def inspect(source, directory):
    expected = json.loads((source / "source-schema.json").read_text())
    member_map = {path: (digest, item) for digest, item in expected["csv_classes"].items()
                  for path in item["paths"]}
    seen = set()
    for name, item in {**expected["archives_2_3_4"], **expected["remaining_archive_names"]}.items():
        path = directory / name
        with path.open("rb") as stream:
            digest = hashlib.sha256()
            for part in iter(lambda: stream.read(1048576), b""):
                digest.update(part)
        assert digest.hexdigest() == item["sha256"], name
        with zipfile.ZipFile(path) as archive:
            names = [entry for entry in archive.namelist() if not entry.endswith("/")]
            known = (item["names"] if "names" in item else [m["name"] for m in item["members"]])
            assert sorted(names) == sorted(known), name
            for entry in names:
                if not entry.lower().endswith(".csv"):
                    continue
                data = archive.read(entry)
                expected_digest, fields = member_map[entry]
                assert hashlib.sha256(data).hexdigest() == expected_digest
                reader = csv.reader(io.StringIO(data.decode("utf-8-sig")))
                header = [token.strip() for token in next(reader)]
                assert header == fields["header"]
                widths = Counter()
                nonempty = [0] * len(header)
                markers = []
                for row in reader:
                    row = [token.strip() for token in row]
                    if not any(row):
                        continue
                    widths[str(len(row))] += 1
                    if len(header) == 11:
                        for col, value in enumerate(row):
                            nonempty[col] += bool(value)
                            if col >= 4 and value and not re.fullmatch(
                                    r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?", value):
                                markers.append((sum(widths.values()), col + 1, value))
                assert dict(widths) == fields["widths"] and sum(widths.values()) == fields["rows"]
                if len(header) == 11:
                    assert nonempty == expected["wide_field_counts"]["nonnull"]
                    assert markers == [(10277, 7, "f3 [Hz]"), (10277, 8, "f3 [Hz]")]
                seen.add(entry)
    assert seen == set(member_map)
    return {"checked_archives": 5, "checked_CSV_paths": len(seen)}


if __name__ == "__main__":
    print(json.dumps(inspect(Path(__file__).parent, Path(sys.argv[1]))))
