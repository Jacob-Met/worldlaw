"""Inspect metadata and wavelength coordinates in the original Eigenvector corn archive."""
import argparse
import hashlib
import json
import math
import struct
import zipfile
import zlib
from pathlib import Path

ZIP_SHA256 = "8a2d1a03648b6ad334caaafa5d8377bf945ba1477a5082c4963d705d07cca795"
MAT_SHA256 = "e28fd4be274a54ca57b1f2c67ef5a8bf4981f8314bcc73e4c64836fe658c46b5"
CHAR_CODECS = {1: "latin1", 2: "latin1", 3: "utf-16-le", 4: "utf-16-le",
               16: "utf-8", 17: "utf-16-le", 18: "utf-32-le"}
NUMERIC_FORMATS = {1: "b", 2: "B", 3: "h", 4: "H", 5: "i", 6: "I",
                   7: "f", 9: "d", 12: "q", 13: "Q"}


def elements(buffer):
    """Yield MATLAB v5 data elements, including the packed small-element representation."""
    offset = 0
    while offset + 8 <= len(buffer):
        tag, size = struct.unpack_from("<II", buffer, offset)
        packed_tag, packed_size = struct.unpack_from("<HH", buffer, offset)
        if 0 < packed_size <= 4 and 0 < packed_tag <= 18:
            yield packed_tag, buffer[offset + 4:offset + 4 + packed_size]
            offset += 8
            continue
        end = offset + 8 + size
        if end > len(buffer):
            raise ValueError("MAT data element exceeds buffer")
        yield tag, buffer[offset + 8:end]
        offset = end if tag == 15 else (end + 7) & ~7


def int32s(buffer):
    return list(struct.unpack(f"<{len(buffer)//4}i", buffer))


def matrix(raw, path=()):
    if not raw:
        return "", {"shape": [], "empty_matrix_payload": True}
    parts = iter(elements(raw))
    _, flags = next(parts)
    _, dimensions = next(parts)
    _, raw_name = next(parts)
    name = raw_name.decode()
    shape = int32s(dimensions)
    kind = struct.unpack_from("<I", flags)[0] & 255
    description = {"shape": shape}
    if kind in (2, 3):
        if kind == 3:
            next(parts)  # MATLAB class name
        field_width = int32s(next(parts)[1])[0]
        field_bytes = next(parts)[1]
        names = [field_bytes[i:i+field_width].split(b"\0")[0].decode()
                 for i in range(0, len(field_bytes), field_width)]
        if math.prod(shape) != 1:
            raise ValueError("unexpected dataset object count")
        fields = {}
        for field_name in names:
            tag, value = next(parts)
            if tag != 14:
                raise ValueError("unexpected nonmatrix object field")
            fields[field_name] = matrix(value, (field_name,))[1]
        description["fields"] = fields
    elif kind == 1:
        description["cells"] = [matrix(value, path + ("cell",))[1]
                                for tag, value in parts if tag == 14]
    elif kind == 4 and (name == "information" or path[:1] in (
            ("label",), ("title",), ("description",), ("history",))):
        tag, value = next(parts, (1, b""))
        chars = value.decode(CHAR_CODECS[tag])
        rows, columns = shape
        description["text"] = ["".join(chars[i + rows*j] for j in range(columns)).strip()
                               for i in range(rows)]
    elif kind == 6 and path == ("axisscale", "cell") and shape == [1, 700]:
        tag, value = next(parts)
        axis = struct.unpack("<700" + NUMERIC_FORMATS[tag], value)
        description["grid_nm"] = {"first": axis[0], "last": axis[-1],
            "all_2nm": all(y - x == 2 for x, y in zip(axis, axis[1:])),
            "sha256": hashlib.sha256(value).hexdigest()}
    # Other numerical arrays, including every dataset's data field, remain opaque.
    return name, description


def text_fields(field):
    return [s for s in field.get("text", []) if s] + [
        s for child in field.get("cells", []) for s in text_fields(child)]


def inspect(archive):
    if hashlib.sha256(archive.read_bytes()).hexdigest() != ZIP_SHA256:
        raise ValueError("unexpected archive")
    with zipfile.ZipFile(archive) as handle:
        data = handle.read("corn.mat")
    if hashlib.sha256(data).hexdigest() != MAT_SHA256 or data[126:128] != b"IM":
        raise ValueError("unexpected MAT file or encoding")
    top = []
    for tag, value in elements(data[128:]):
        if tag == 15:
            top.extend(elements(zlib.decompress(value)))
        else:
            top.append((tag, value))
    result = {}
    for tag, raw in top:
        if tag != 14:
            raise ValueError("unexpected top-level content")
        name, obj = matrix(raw)
        if name == "information":
            result[name] = {"shape": obj["shape"], "text": obj["text"]}
            continue
        record = obj["fields"]
        axis = record["axisscale"]["cells"]
        result[name] = {"array_shape": record["data"]["shape"], "labels": text_fields(record["label"]),
            "titles": text_fields(record["title"]), "description": text_fields(record["description"]),
            "history": text_fields(record["history"]), "case_axis": axis[0]["shape"],
            "axis_coordinates": [entry["grid_nm"] for entry in axis if "grid_nm" in entry],
            "embedded_signal_values_decoded": 0}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = inspect(args.archive)
    for instrument, count in (("m5", 3), ("mp5", 4), ("mp6", 4)):
        for suffix, rows in (("spec", 80), ("nbs", count)):
            obj = result[instrument + suffix]
            assert obj["array_shape"] == [rows, 700] and obj["case_axis"] == [0, 0]
            assert not any(obj[key] for key in ("labels", "titles", "description"))
            axis, = obj["axis_coordinates"]
            assert (axis["first"], axis["last"], axis["all_2nm"]) == (1100, 2498, True)
    assert result["propvals"]["labels"] == ["Moisture", "Oil", "Protein", "Starch"]
    output = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(output)
    else:
        print(output, end="")


if __name__ == "__main__":
    main()
