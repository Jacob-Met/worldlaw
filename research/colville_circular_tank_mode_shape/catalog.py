"""Inspect the official small archive and file schemas without reading any measured ordinate."""
import csv
import hashlib
import io
import json
import pathlib
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

url = "https://researchportal.plymouth.ac.uk/files/63656639/Experimental_data_Sloshing_in_a_circular_tank.zip"
request = urllib.request.Request(url, headers={"User-Agent": "public research dataset schema reader"})
def sha(data):
    return hashlib.sha256(data).hexdigest()
def spreadsheet_schema(data):
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(io.BytesIO(data)) as book:
        wb = ET.fromstring(book.read("xl/workbook.xml"))
        return {"sheets": [s.attrib.get("name") for s in wb.findall("m:sheets/m:sheet", ns)],
                "worksheet_members": [n for n in book.namelist() if n.startswith("xl/worksheets/") and n.endswith(".xml")]}
with urllib.request.urlopen(request, timeout=80) as f:
    archive = f.read(4000001)
assert 0 < len(archive) <= 4000000
report = {"bytes": len(archive), "sha256": sha(archive), "entries": [], "numerical_values_read": False}
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    for e in z.infolist():
        row = {"path": e.filename, "bytes": e.file_size, "crc32": e.CRC}
        lower = e.filename.lower()
        if lower.endswith(".xlsx") and "/__macosx/" not in "/"+lower and not pathlib.PurePosixPath(lower).name.startswith("._"):
            row.update(spreadsheet_schema(z.read(e)))
        report["entries"].append(row)
print(json.dumps(report, sort_keys=True))
