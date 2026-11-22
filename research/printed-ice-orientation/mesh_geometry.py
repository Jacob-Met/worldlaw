"""Read only the twenty released aggregate meshes and calculate their homogeneous inertia."""
import hashlib
import io
import re
import struct
import zipfile

import numpy as np

ARCHIVE_SHA = '4c949ee53e6abfd7951fb14bb3d816937505f89ba05ccc604537c9c9847e0172'


def mesh_triangles(raw):
    if len(raw) >= 84 and 84 + 50*struct.unpack_from('<I',raw,80)[0] == len(raw):
        dtype = np.dtype([('normal','<f4',(3,)),('triangle','<f4',(3,3)),('attribute','<u2')])
        return np.frombuffer(raw[84:],dtype=dtype)['triangle'].astype(float)
    numbers = re.findall(rb'(?mi)^\s*vertex\s+(\S+)\s+(\S+)\s+(\S+)\s*$',raw)
    if not numbers or len(numbers) % 3:
        raise ValueError('unsupported STL triangle syntax')
    return np.asarray(numbers,dtype=float).reshape(-1,3,3)


def source_meshes(raw):
    if hashlib.sha256(raw).hexdigest() != ARCHIVE_SHA:
        raise ValueError('unexpected source archive')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        return {name.rsplit('/',1)[-1][:-4]:mesh_triangles(archive.read(name))
                for name in archive.namelist() if name.endswith('.stl')}


def geometry(triangles):
    # The signed tetrahedra with common origin recover volume moments exactly
    # in real arithmetic for a closed consistently oriented solid boundary.
    center0 = triangles.mean(axis=(0,1))
    t = triangles - center0
    weights = np.einsum('ij,ij->i',t[:,0],np.cross(t[:,1],t[:,2])) / 6
    volume = weights.sum()
    if volume < 0:
        return geometry(triangles[:,::-1])
    if volume == 0:
        raise ValueError('zero oriented volume')
    sums = t.sum(axis=1)
    center = (weights @ sums) / (4*volume)
    second = (np.einsum('i,ij,ik->jk',weights,sums,sums)
              + np.einsum('i,iaj,iak->jk',weights,t,t))/(20*volume)
    cov = second - np.outer(center,center)
    inertia = np.eye(3)*np.trace(cov)-cov
    vals, axes = np.linalg.eigh(inertia)
    if np.linalg.det(axes)<0:
        axes[:,0]*=-1
    if vals[0] <= 0: raise ValueError('nonpositive source moment')
    t = (t-center)/volume**(1/3)
    vertices, ids = np.unique(t.reshape(-1,3),axis=0,return_inverse=True)
    faces = ids.reshape(-1,3)
    edges = np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]])
    _,freq = np.unique(np.sort(edges,axis=1),return_counts=True,axis=0)
    cross = np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0])
    area = np.linalg.norm(cross,axis=1)/2
    invariant = np.sort(np.round(np.linalg.norm(vertices,axis=1),7))
    return dict(triangles=t,vertices=vertices,faces=faces,axes=axes,
                ratios=vals/vals[-1],area=float(area.sum()),volume=float(volume),
                bad_edges=int(np.sum(freq!=2)),zero_area=int(np.sum(area==0)),
                radial_fingerprint=hashlib.sha256(invariant.astype('<f8').tobytes()).hexdigest())


if __name__ == '__main__':
    import argparse, json
    from pathlib import Path
    p = argparse.ArgumentParser()
    p.add_argument('archive',type=Path)
    args=p.parse_args()
    for name,t in sorted(source_meshes(args.archive.read_bytes()).items()):
        g=geometry(t)
        print(json.dumps({'name':name,'faces':len(g['faces']),'vertices':len(g['vertices']),
                          'bad_edges':g['bad_edges'],'zero_area':g['zero_area'],'volume_native':g['volume'],
                          'area_normalized':g['area'],'inertia_ratios':g['ratios'].tolist(),
                          'normalized_radial_fingerprint':g['radial_fingerprint']},sort_keys=True))
