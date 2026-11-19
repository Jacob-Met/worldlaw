#!/usr/bin/env python3
"""Receive the prospectively selected MAGF-ID files without parsing measurements.

Uses HTTPS byte ranges, ZIP CRC32 and the frozen uncompressed member SHA256s.
The publisher's full-archive MD5 is metadata; this does not fetch the whole ZIP.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import struct
import time
import urllib.request
import zlib


def sha(data):
    return hashlib.sha256(data).hexdigest()


def immutable_write(path, data):
    if path.exists():
        if path.read_bytes() != data:
            raise ValueError(f'existing file disagrees with frozen input: {path}')
        return
    with path.open('xb') as stream:
        stream.write(data)


def receive(destination, frozen):
    destination, frozen = Path(destination).resolve(), Path(frozen).resolve()
    if destination == frozen:
        raise ValueError('raw-data destination must differ from tracked metadata')
    destination.mkdir(parents=True, exist_ok=True)
    names = ['magfid-v1-zip-manifest.json', 'physical-covariance-protocol.json', 'physical-covariance-split.json']
    content = {name: (frozen / name).read_bytes() for name in names}
    manifest, protocol, split = [json.loads(content[name]) for name in names]
    assert protocol['directory_manifest_sha256'] == sha(content[names[0]])
    assert split['protocol_sha256'] == sha(content[names[1]])
    assert split['numeric_rows_opened'] is False
    assert [len(split[name]) for name in ['train', 'validation', 'test']] == [9, 4, 4]
    assert len(split['member_hashes']) == 68
    selected = {entry['name']: entry for entry in manifest['entries'] if entry['name'] in protocol['members']}
    assert len(selected) == 68 and set(selected) == set(split['member_hashes'])
    for name, data in content.items():
        immutable_write(destination / name, data)
    raw_dir = destination / 'raw'; raw_dir.mkdir(exist_ok=True)

    def get_range(offset, length):
        if not 0 < length <= 8 * 1024 * 1024:
            raise ValueError('ZIP member range exceeds the fixed receiving bound')
        expected = f'bytes {offset}-{offset+length-1}/{manifest["bytes"]}'
        for attempt in range(4):
            try:
                request = urllib.request.Request(manifest['url'], headers={
                    'Range': f'bytes={offset}-{offset+length-1}',
                    'User-Agent': 'Worldlaw-MAGF-ID-source-receiver/1'})
                with urllib.request.urlopen(request, timeout=45) as response:
                    if response.status != 206 or response.headers.get('Content-Range') != expected:
                        raise ValueError('source server did not honor the exact byte range')
                    data = response.read(length + 1)
                    if len(data) != length:
                        raise ValueError('truncated source range')
                    return data
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(attempt + 1)

    def member(name):
        entry, expected = selected[name], split['member_hashes'][name]
        if Path(expected['local_name']).name != expected['local_name']:
            raise ValueError('raw member name must be a basename')
        target = raw_dir / expected['local_name']
        if target.exists():
            data = target.read_bytes()
        else:
            length = min(entry['compressed'] + 2078, manifest['bytes'] - entry['offset'])
            blob = get_range(entry['offset'], length)
            fields = struct.unpack('<4s5H3I2H', blob[:30])
            if fields[0] != b'PK\x03\x04' or fields[3] != 8 or fields[2] & 1:
                raise ValueError('unexpected source ZIP header')
            name_length, extra_length = fields[-2:]
            start = 30 + name_length + extra_length
            if start > 2078 or blob[30:30+name_length].decode() != name:
                raise ValueError('ZIP member does not match the frozen directory')
            data = zlib.decompress(blob[start:start+entry['compressed']], -15)
        if len(data) != expected['bytes'] or len(data) != entry['size']:
            raise ValueError('source member length differs')
        if f'{zlib.crc32(data) & 0xffffffff:08x}' != entry['crc32'] or sha(data) != expected['sha256']:
            raise ValueError('source member CRC32 or SHA256 differs: ' + name)
        immutable_write(target, data)
        return name, sha(data)

    actual = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        for name, digest in pool.map(member, sorted(selected, key=lambda name: selected[name]['offset'])):
            actual[name] = digest
            if len(actual) % 8 == 0 or len(actual) == 68:
                print(json.dumps({'verified_members': len(actual), 'total': 68, 'measurements_parsed': False}), flush=True)
    reconstructed = []
    for recording in split['train'] + split['validation'] + split['test']:
        members = {sensor: actual[name] for sensor, name in recording['members'].items()}
        digest = sha(json.dumps(members, sort_keys=True, separators=(',', ':')).encode())
        if digest != recording['sha256']:
            raise ValueError('recording aggregate hash differs')
        reconstructed.append((digest, recording['name']))
    expected_order = [recording['name'] for group in ['train', 'validation', 'test'] for recording in split[group]]
    assert [name for _, name in sorted(reconstructed)] == expected_order
    print(json.dumps({'source_doi': manifest['source'], 'source_file_id': manifest['file_id'],
        'verified_raw_bytes': sum(entry['bytes'] for entry in split['member_hashes'].values()),
        'split_sha256': sha(content[names[2]]), 'measurements_parsed': False}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data', required=True, help='External directory for 68 source CSV files')
    parser.add_argument('--frozen', default=str(Path(__file__).resolve().parents[1] / 'research' / 'magfid-covariance'))
    args = parser.parse_args()
    receive(args.data, args.frozen)
