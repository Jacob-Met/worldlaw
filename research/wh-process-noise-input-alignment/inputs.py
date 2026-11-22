"""Read only the command, measured input and sample rate of pinned MAT-v5 structs."""

import struct
import zlib

import numpy as np


def element(data, offset):
    code, size = struct.unpack_from("<II", data, offset)
    inline = code >> 16
    if inline:
        if inline > 4:
            raise ValueError("Invalid inline MAT element")
        return code & 65535, data[offset + 4:offset + 4 + inline], offset + 8
    end = offset + 8 + size
    if end > len(data):
        raise ValueError("Truncated MAT element")
    following = end if code == 15 else offset + 8 + 8 * ((size + 7) // 8)
    return code, data[offset + 8:end], following


def header(data):
    kind, flags, offset = element(data, 0)
    if kind != 6:
        raise ValueError("Missing MAT flags")
    kind, shape, offset = element(data, offset)
    if kind != 5:
        raise ValueError("Missing MAT dimensions")
    dims = struct.unpack("<" + "i" * (len(shape) // 4), shape)
    _, name, offset = element(data, offset)
    return struct.unpack_from("<I", flags)[0] & 255, dims, bytes(name).decode(), offset


def number(data):
    kind, dims, _, offset = header(data)
    if not 6 <= kind <= 15:
        raise ValueError("Expected an ordinary real numeric input matrix")
    dtype, payload, _ = element(data, offset)
    types = {1: "i1", 2: "u1", 3: "<i2", 4: "<u2", 5: "<i4", 6: "<u4",
             7: "<f4", 9: "<f8", 12: "<i8", 13: "<u8"}
    return np.frombuffer(payload, types[dtype]).reshape(dims, order="F")


def project(raw):
    if raw[:8] != b"MATLAB 5" or raw[126:128] != b"IM":
        raise ValueError("Expected a little-endian MAT-v5 file")
    kind, body, end = element(memoryview(raw), 128)
    if end != len(raw):
        raise ValueError("Unexpected second top-level member")
    if kind == 15:
        inflated = memoryview(zlib.decompress(body))
        kind, body, end = element(inflated, 0)
        if end != len(inflated):
            raise ValueError("Trailing compressed payload")
    if kind != 14:
        raise ValueError("Expected matrix element")
    cls, shape, name, offset = header(body)
    if cls != 2 or shape != (1, 1):
        raise ValueError(f"Unexpected struct {name} {shape}")
    _, width, offset = element(body, offset)
    width = struct.unpack_from("<i", width)[0]
    _, names, offset = element(body, offset)
    fields = [bytes(names[i:i + width]).split(b"\0")[0].decode()
              for i in range(0, len(names), width)]
    if fields != ["r", "u", "y", "fs"]:
        raise ValueError(f"Unrecognized field order {fields}")
    values = {}
    for field in fields:
        kind, member, offset = element(body, offset)
        if kind != 14:
            raise ValueError("Unexpected field element")
        if field in {"r", "u", "fs"}:
            values[field] = number(member)
    return values
