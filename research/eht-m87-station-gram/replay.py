"""Reconstruct every source-metadata row and execute exact synthetic checks."""
import json
from pathlib import Path
import subprocess
import sys

study = Path(__file__).resolve().parent
expected = json.loads((study / "metadata.json").read_text())
output = subprocess.check_output([sys.executable, str(study / "inspect_metadata.py")], text=True)
rows = [json.loads(line.split(" ", 1)[1]) for line in output.splitlines()
        if line.startswith("DURATION ")]
assert rows == expected["rows"] and len(rows) == 8
totals = {key: sum(row["counts"][key] for row in rows) for key in rows[0]["counts"]}
assert totals == expected["counts"] and sum(row["groups"] for row in rows) == 51119
for script in ("overlap.py", "positive_weights.py"):
    subprocess.run([sys.executable, str(study / script)], check=True)
print("Eight metadata exports and all duration witnesses reproduced.", totals)
