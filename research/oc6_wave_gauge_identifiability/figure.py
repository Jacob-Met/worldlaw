"""Read the plotted B4 wave-check symbols from the authenticated paper raster."""
import hashlib
import math
from pathlib import Path

import numpy as np
from PIL import Image

from geometry import PIVOT, SCALE, POSITIONS

SOURCE_SHA = "c232830c94c3a8ad0effb88a1439bd51ddc20de880af7a8e7be0d4fd6570c8ab"


def extract(path):
    path = Path(path)
    if hashlib.sha256(path.read_bytes()).hexdigest() != SOURCE_SHA:
        raise ValueError("Expected the original embedded JPEG, object 234 of the Wang paper")
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(int)
    if rgb.shape != (514, 1446, 3):
        raise ValueError("Unexpected original raster dimensions")
    red, green, blue = rgb.transpose(2,0,1)
    masks = {"real": (blue-red > 80) & (blue-green > 80),
             "imag": (red-green > 80) & (red-blue > 80),
             "magnitude": np.max(rgb,axis=2) < 100}
    dark = masks["magnitude"]
    col_support = dark[18:418,:].sum(axis=0)
    row_support = dark[:,166:1410].sum(axis=1)
    left = int(116+np.argmax(col_support[116:231]))
    right = int(1359+np.argmax(col_support[1359:]))
    top = int(np.argmax(row_support[:51]))
    bottom = int(396+np.argmax(row_support[396:463]))
    if min(col_support[left],col_support[right]) < 390 or min(row_support[top],row_support[bottom]) < 950:
        raise ValueError("Insufficient source axis-frame support")

    # Figure 7 legend contains an isolated sample of each printed symbol.
    # Center it from its bounding box; do not derive shapes from measurements.
    calibrators = {}
    templates = {}
    for label, band in {"real":(239,262), "imag":(273,294), "magnitude":(305,326)}.items():
        start, stop = band
        ys,xs = np.where(masks[label][start:stop,178:203])
        if len(ys) < 20:
            raise ValueError(f"Missing legend marker: {label}")
        xs += 178
        ys += start
        x = int(np.floor((xs.min()+xs.max())/2+.5))
        y = int(np.floor((ys.min()+ys.max())/2+.5))
        shape = masks[label][y-9:y+10,x-8:x+9]
        calibrators[label] = {"pixel":[x,y],"on_pixels":int(shape.sum()),
                              "limits":[int(xs.min()),int(xs.max()),int(ys.min()),int(ys.max())]}
        templates[label] = shape

    y_scale = .06/(bottom-top)
    def vertical(y):
        return .03 - (y-top)*y_scale
    stations = []
    for x_model in POSITIONS["center"]:
        design_x = (x_model-PIVOT)*SCALE
        x_guess = int(round(left+(design_x+300)*(right-left)/600))
        markers = {}
        for label, shape in templates.items():
            options = []
            mask = masks[label]
            for x in range(x_guess-3,x_guess+4):
                for y in range(top+9,bottom-8):
                    if x < 389 and y >= 231:
                        continue  # printed legend occludes this rectangle
                    patch = mask[y-9:y+10,x-8:x+9]
                    occluded = dark[y-9:y+10,x-8:x+9] if label == "real" else False
                    overlap = int((patch & shape).sum())
                    if overlap < 15:
                        continue
                    missed = int(np.count_nonzero(shape & ~patch & np.logical_not(occluded)))
                    extra = int(np.count_nonzero(patch & ~shape))
                    # A curve that merely crosses the neighborhood leaves most
                    # of the legend symbol absent. Black can overprint a blue dot.
                    cost = (missed + .35*extra) / max(overlap, 1)
                    options.append((cost,-overlap,x,y,missed,extra))
            if not options:
                raise ValueError(f"Missing {label} mark near x={x_guess}")
            options.sort()
            best = options[0]
            other = [opt for opt in options if abs(opt[3]-best[3]) >= 8]
            peer = other[0] if other else None
            markers[label] = {"pixel":[best[2],best[3]], "cost":best[0],
                              "visible_overlap":-best[1],"missing":best[4],"extra":best[5],
                              "separate_runner_up": list(peer) if peer else None,
                              "ordinate_m":vertical(best[3])}
        real,imag,magnitude=[markers[k]["ordinate_m"] for k in ("real","imag","magnitude")]
        mean_x = np.mean([m["pixel"][0] for m in markers.values()])
        stations.append({"design_x_m":design_x,
                         "graph_x_m":float(-300+600*(mean_x-left)/(right-left)),
                         "markers":markers, "magnitude_discrepancy_m":abs(math.hypot(real,imag)-magnitude)})
    return {"axis_frame_px":[left,right,top,bottom],"vertical_m_per_pixel":y_scale,
            "legend_markers":calibrators,"stations":stations}
