"""Authored camera-projection movies for Motion's metric-plane consumer.

Requires Pillow and ffmpeg. No captured physical evidence or external media.
The camera maps and true oscillator are independent of the production fitter.
"""
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw

destination = Path(sys.argv[1] if len(sys.argv) > 1 else ".receipts/metric-plane-fixtures")
destination.mkdir(parents=True, exist_ok=True)
WIDTH, HEIGHT, FPS, COUNT = 640, 480, 30, 240
CASES = [
    ("fit", .75, [170, 20, 320, 10, 120, 90, .08, -.04, 1]),
    ("challenge", 1.05, [125, -30, 325, 25, 165, 85, -.055, .065, 1]),
]


def point(h, x, y):
    w = h[6] * x + h[7] * y + h[8]
    return ((h[0] * x + h[1] * y + h[2]) / w,
            (h[3] * x + h[4] * y + h[5]) / w)


receipts = []
for name, amplitude, camera in CASES:
    video = destination / (name + ".mp4")
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
               "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "pipe:0", "-an", "-c:v", "libx264",
               "-preset", "fast", "-crf", "12", "-pix_fmt", "yuv420p", "-threads", "1",
               "-metadata", "comment=Authored WORLDLAW metric-plane control; not physical evidence", str(video)]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    pivot = point(camera, 0, 0)
    pairs = [{"image": dict(zip(("x", "y"), point(camera, x, y))), "plane": {"x": x, "y": y}}
             for x, y in [(-.8, 0), (.8, 0), (.8, 1.6), (-.8, 1.6)]]
    truth = []
    for i in range(COUNT):
        t = i / FPS
        angle = amplitude * math.exp(-.08 * t) * math.cos(1.6 * t)
        x, y = math.sin(angle), math.cos(angle)
        marker = point(camera, x, y)
        image = Image.new("RGB", (WIDTH, HEIGHT), (20, 35, 44))
        draw = ImageDraw.Draw(image)
        for grid_x in [j / 5 for j in range(-7, 8)]:
            draw.line([point(camera, grid_x, -.3), point(camera, grid_x, 1.9)], fill=(33, 57, 69), width=1)
        for grid_y in [j / 5 for j in range(-1, 10)]:
            draw.line([point(camera, -1.4, grid_y), point(camera, 1.4, grid_y)], fill=(33, 57, 69), width=1)
        for j, pair in enumerate(pairs):
            px, py = pair["image"]["x"], pair["image"]["y"]
            draw.rectangle((px - 4, py - 4, px + 4, py + 4), fill=(255, 186, 96))
            draw.text((px + 8, py - 7), str(j + 1), fill=(255, 220, 166))
        draw.line([pivot, marker], fill=(148, 187, 190), width=3)
        draw.ellipse((pivot[0] - 7, pivot[1] - 7, pivot[0] + 7, pivot[1] + 7), fill=(220, 235, 236))
        # A textured patch in the same metric plane; it is genuinely projected,
        # so its shape and scale may vary across the authored source frames.
        for cy in range(-5, 6):
            for cx in range(-5, 6):
                cell = .022
                value = 45 + (((cx + 7) * 73856093 ^ (cy + 9) * 19349663) % 190)
                corners = [point(camera, x + (cx + dx) * cell, y + (cy + dy) * cell)
                           for dx, dy in [(-.5, -.5), (.5, -.5), (.5, .5), (-.5, .5)]]
                draw.polygon(corners, fill=(value, value, value))
        draw.text((14, 14), "AUTHORED CAMERA CONTROL / " + name.upper(), fill=(172, 203, 217))
        draw.text((14, 32), "Original projected grid and marker; not a physical recording", fill=(148, 176, 190))
        process.stdin.write(image.tobytes())
        truth.append({"time": t, "angle": angle, "point": dict(zip(("x", "y"), marker))})
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg did not encode " + name)
    digest = hashlib.sha256(video.read_bytes()).hexdigest()
    declaration = {"schema": "worldlaw.metric-plane/v1", "source": {"sha256": digest, "width": WIDTH, "height": HEIGHT},
                   "referenceTime": 0, "coordinateUnit": "m",
                   "basis": "Known independent camera projection and metric grid in an authored synthetic video; not physical calibration.",
                   "assumptions": {"samePlane": True, "fixedCamera": True, "metricCoordinates": True,
                                   "negligibleLensDistortion": True}, "pairs": pairs}
    (destination / (name + "-plane.json")).write_text(json.dumps(declaration, indent=2) + "\n")
    receipts.append({"name": name, "file": video.name, "sha256": digest, "camera": camera, "amplitude": amplitude,
                     "duration": COUNT / FPS, "frameRate": FPS, "pivot": dict(zip(("x", "y"), pivot)),
                     "initialRate": -.08 * amplitude, "truth": truth})
(destination / "truth.json").write_text(json.dumps({"scope": "Authored synthetic video and known camera controls; not physical evidence.",
                                                  "courses": receipts}, indent=2) + "\n")
print(json.dumps({"directory": str(destination), "sources": [{k: case[k] for k in ["file", "sha256"]} for case in receipts]}))
