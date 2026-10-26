#!/usr/bin/env python3
"""Create a deterministic, explicitly scoped WORLDLAW source distribution."""

import argparse
import fnmatch
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import tempfile
import zipfile


ROOT = Path(__file__).resolve().parents[1]
INCLUDE = (
    # Exact source dependencies of the maintained position-covariance course.
    "experiments/position-covariance-oracle.py", "tests/fixtures/covariance-course.mjs",
    "docs/receipts/applied-torque-760d4cf/README.md",
    "independent-review/soft-l1-oracle.py",
    # Source-bound metric-plane consumer and exact authored receiving fixtures.
    "src/motion/vendor/plane-homography.mjs", "src/motion/vendor/plane-homography-source.json",
    "tests/helpers/metric-plane-course.mjs", "scripts/make-metric-plane-fixtures.py",
    "examples/metric-plane/fit.mp4", "examples/metric-plane/challenge.mp4",
    "examples/metric-plane/fit-plane.json", "examples/metric-plane/challenge-plane.json",
    "examples/metric-plane/truth.json",
    # Exact authored decoded-video notebooks used by the starting-state receiver.
    "examples/motion-prefix/fit-plane-notebook.json", "examples/motion-prefix/challenge-plane-notebook.json",
    # Maintained application routes and their exact shared-source dependencies.
    "motion-reference.html", "motion-reference.css",
    "src/motion/vendor/mechanism-core.mjs", "src/motion/vendor/mechanism-source.json",
    "src/motion/vendor/reference-admission.mjs", "src/motion/vendor/reference-source.json",
    "tests/coupling-shared-course-fixture.mjs", "tests/response-contrast-fixture.mjs",
    "tests/fixtures/command-response-moments.json",
    "tests/fixtures/readout-assignment-oracle.json",
    "tests/fixtures/weighted-readings.mjs",
    "examples/physical-nad-56bd8a/AUTHOR-DATASET-CARD.md",
    "examples/physical-nad-56bd8a/AUTHOR-LICENSE",
    "examples/physical-nad-56bd8a/README.md",
    "examples/physical-nad-56bd8a/test-200_006.csv",
    "examples/physical-nad-56bd8a/train-200_001.csv",
    "docs/receipts/sensor-response-56bd8a/README.md",
    "scripts/support/README.md", "scripts/support/chromium-sandbox.mjs",
    "scripts/package-policy-test.py",
    "COUPLED_POINT_RESPONSE.md", "COUPLING_EXCITATION_WITNESSES.md",
    "docs/receipts/forced-weak-760d4cf/README.md",
    # Explicit retained receiving evidence; do not admit arbitrary nested outputs.
    "docs/receipts/command-deadzone-56bd8a/native-tests.txt",
    "docs/receipts/command-deadzone-56bd8a/studio-smoke.txt",
    "docs/receipts/command-deadzone-56bd8a/trajectory-smoke.txt",
    "docs/verification/correlation-band-browser.json",
    "docs/verification/correlation-band-desktop.png",
    "docs/verification/correlation-band-narrow.png",
    "docs/verification/correlation-band-native.json",
    "docs/verification/correlation-band-strips.png",
    "docs/verification/coupled-inertia/inertia-1440.png",
    "docs/verification/coupled-inertia/inertia-390.png",
    "docs/verification/coupled-inertia/motion-form-390.png",
    "docs/verification/coupled-inertia/motion-modes-390.png",
    "docs/verification/coupled-inertia/native.json",
    "docs/verification/coupled-inertia/receiving.json",
    "docs/verification/coupled-inertia/sandbox.json",
    "docs/verification/drift-construction-complete-narrow.png",
    "docs/verification/drift-construction-desktop.png",
    "docs/verification/drift-construction.json",
    "evidence/clock-tick-host-export.json",
    "evidence/conditional-rate/conditional-desktop.png",
    "evidence/conditional-rate/conditional-narrow.png",
    "evidence/conditional-rate/conditional-notebook.json",
    "evidence/conditional-rate/receiving.md",
    "evidence/conditional-rate/source-manifest.json",
    "evidence/energy-accounting-8d076f/energy-desktop.png",
    "evidence/energy-accounting-8d076f/energy-narrow.png",
    "evidence/energy-accounting-8d076f/source-manifest.json",
    "evidence/rate-dissipation-8d076f/rate-desktop.png",
    "evidence/rate-dissipation-8d076f/rate-narrow.png",
    "evidence/rate-dissipation-8d076f/source-manifest.json",
    "evidence/rate-reversal/receiving.md",
    "evidence/rate-reversal/reversal-desktop.png",
    "evidence/rate-reversal/reversal-narrow.png",
    "evidence/rate-reversal/reversal-notebook.json",
    "evidence/rate-reversal/source-manifest.json",
    "evidence/reversal-native-summary.txt",
    "independent-review/interaction-review.mjs", "independent-review/interaction-oracle.py",
    "independent-review/interaction-oracle-cases.json", "docs/receipts/interaction-9e01d4dd/*.txt",
    "separability.css", "examples/separability/*.json",
    "independent-review/separability-oracle.py", "docs/receipts/separability-9e01d4dd/*.txt",
    "cycle-work.html", "src/cycle-work/*.mjs",
    "stiffness.html", "stiffness.css", "src/stiffness/*.mjs",
    "docs/receipts/stiffness-20261024/*.json", "docs/receipts/stiffness-20261024/*.png",
    "AGENTS.md", "README.md", "LICENSE", "LICENSE.md", "package.json",
    "index.html", "styles.css", "favicon.svg", "server.mjs", "motion.html", "motion.css", "trajectory.html", "trajectory.css",
    "docs/receipts/*/*.json", "docs/receipts/*/*.png",
    "docs/receipts/branch-response-20261024/README.md",
    "docs/receipts/branch-response-20261024/maintained-angle-boxes.txt",
    "docs/receipts/prediction-contrast-195c0e2a/README.md",
    "docs/receipts/prediction-contrast-195c0e2a/initial-focused-failure.txt",
    "docs/receipts/prediction-contrast-195c0e2a/native-tests.txt",
    "docs/receipts/shared-training-195c0e2a/README.md",
    "docs/receipts/shared-training-195c0e2a/native-tests.txt",
    "docs/*.md", "docs/*.json", "src/*.mjs", "src/science/*.mjs", "src/motion/*.mjs", "src/trajectory/*.mjs", "src/representation/*.mjs",
    "src/experiment-design/*.mjs", "tests/support/*.mjs",
    "unknown-lab.html", "unknown-lab.css", "src/unknown-lab/*.mjs",
    "coupling.html", "coupling.css", "src/coupling/*.mjs",
    "scripts/*.mjs", "scripts/package.py", "scripts/generate-motion-fixtures-15cc.py", "tests/*.test.mjs",
    "examples/*.json", "experiments/*.mjs", "research/PHYSICAL_TELEMETRY_92be.md",
    "examples/physical-pasco-92be/README.md", "examples/physical-pasco-92be/LICENSE",
    "examples/physical-pasco-92be/build-bundle.py", "examples/physical-pasco-92be/receive.mjs",
    "examples/physical-pasco-92be/raw/*.csv",
    "evidence/active-discovery-results.json",
    "evidence/derived-telemetry-observations.json",
    "evidence/angle-reference-results.json",
    "evidence/cubic-restoring-results.json",
    'docs/receipts/predictive-selection-20261024/*.json',
    'docs/receipts/predictive-selection-20261024/*.png',
    'docs/receipts/predictive-selection-20261024/offline/*.json',
    'docs/receipts/predictive-selection-20261024/offline/*.png',
    'docs/receipts/prediction-baselines-20261024/*.json',
    'docs/receipts/prediction-baselines-20261024/*.png',
    'src/predictive-selection/*.mjs',
    'experiments/active-discovery.mjs',
    'experiments/integral-discovery-92be.mjs',
    'experiments/integral-stability-92be.mjs',
    'experiments/angular-weak-92be.mjs',
    'experiments/trajectory-planning-92be.mjs',
    'experiments/trajectory-numerical-qualification.mjs',
    'experiments/angle-reference.mjs',
    'evidence/predictive-selection-results.json',
    'experiments/predictive-selection.mjs',
    'experiments/cubic-restoring.mjs',
    'docs/receipts/duration-response-20261024/verification.json',
    'docs/receipts/duration-planner-20261024/verification.json',
    'docs/receipts/continuous-duration-20261024/verification.json',
    'experiments/initial-state-sensitivity.mjs',
    'experiments/angular-prelude.mjs',
    'experiments/rolling-origin.mjs',
)
REQUIRED = (
    "src/science/experiment-receipts.mjs", "src/science/experiment-receipts-panel.mjs",
    "src/science/studio-dynamics-comparison.mjs", "src/science/studio-comparison-panel.mjs",
    "src/science/studio-comparison-view.mjs",
    "src/science/robust-fit.mjs",
    "src/motion/metric-plane.mjs", "src/motion/metric-plane-panel.mjs", "src/motion/plane-path-reference.mjs",
    "src/motion/vendor/plane-homography.mjs", "src/motion/vendor/plane-homography-source.json",
    "motion-reference.html", "motion-reference.css", "src/motion/reference-app.mjs",
    "src/motion/vendor/mechanism-core.mjs", "src/motion/vendor/mechanism-source.json",
    "src/motion/vendor/reference-admission.mjs", "src/motion/vendor/reference-source.json",
    "separability.css", "src/science/separability.mjs", "src/science/separability-panel.mjs",
    "cycle-work.html", "src/cycle-work/app.mjs", "src/cycle-work/core.mjs",
    "src/cycle-work/refinement.mjs", "src/cycle-work/refinement-panel.mjs", "src/cycle-work/refinement-example.mjs",
    "src/cycle-work/curvature-witness.mjs",
    "src/cycle-work/angle-boxes.mjs", "src/cycle-work/angle-boxes-panel.mjs", "src/cycle-work/angle-boxes-example.mjs",
    "src/cycle-work/branch-response.mjs", "src/cycle-work/branch-response-panel.mjs", "src/cycle-work/branch-response-example.mjs",
    "stiffness.html", "stiffness.css", "src/stiffness/app.mjs", "src/stiffness/science.mjs", "src/stiffness/notebook.mjs", "src/stiffness/fixture.mjs", "src/stiffness/experiment.mjs", "src/stiffness/experiment-fixture.mjs", "src/stiffness/experiment-panel.mjs", "src/science/linear-fit.mjs",
    "coupling.html", "coupling.css", "src/coupling/app.mjs", "src/coupling/science.mjs",
    "src/coupling/dynamics.mjs", "src/coupling/dynamics-panel.mjs",
    "src/coupling/notebook.mjs", "src/coupling/virtual-instrument.mjs", "src/science/linear-fit.mjs",
    "unknown-lab.html", "unknown-lab.css", "src/unknown-lab/app.mjs", "src/unknown-lab/paired-history.mjs",
    "src/unknown-lab/periodic-history-range.mjs", "src/unknown-lab/periodic-history-range-panel.mjs",
    "README.md", "package.json", "index.html", "styles.css", "favicon.svg",
    "server.mjs", "src/app.mjs", "src/data.mjs", "src/session.mjs",
    "src/science/torque-discovery.mjs", "src/science/virtual-lab.mjs",
    "src/science/trajectory-observations.mjs", "scripts/package.py",
    "docs/DISTRIBUTION.md",
    "motion.html", "motion.css", "src/motion/app.mjs", "src/motion/demo.mjs",
    "src/motion/measurement.mjs", "src/motion/tracker.mjs", "src/motion/video.mjs",
    "trajectory.html",
    "trajectory.css",
    "src/trajectory/app.mjs",
    "src/representation/angle-reference.mjs",
    "src/representation/reference-panel.mjs",
    "src/trajectory/data.mjs",
    "src/trajectory/session.mjs",
    "src/trajectory/baselines.mjs",
    "src/trajectory/forward.mjs",
    "src/trajectory/resolution.mjs",
    "src/trajectory/horizon.mjs",
    "src/trajectory/integral-discovery.mjs",
    "src/trajectory/angular-discovery.mjs",
    "src/trajectory/angular-weak.mjs",
    "src/trajectory/angular-resolution.mjs",
    "src/trajectory/planner.mjs",
    "src/trajectory/virtual-experiment.mjs",
    "src/trajectory/experiment-session.mjs",
    "src/trajectory/experiment-panel.mjs",
    "src/experiment-design/qualify-trajectory-plan.mjs",
    "src/experiment-design/screened-controller.mjs",
    "tests/support/trajectory-planner-baseline.mjs",
    "experiments/trajectory-planning-92be.mjs",
    "experiments/trajectory-numerical-qualification.mjs",
    "docs/TRAJECTORY_PLANNER.md",
    "docs/TRAJECTORY_EXPERIMENT_RELEASE_92be.md",
    "examples/trajectory-pendulum-92be.json",
    "examples/trajectory-ambiguous-92be.json",
    "examples/physical-pasco-92be.json",
    "research/PHYSICAL_TELEMETRY_92be.md",
    "examples/physical-pasco-92be/README.md",
    "examples/physical-pasco-92be/LICENSE",
    "examples/physical-pasco-92be/build-bundle.py",
    "examples/physical-pasco-92be/receive.mjs",
    "examples/physical-pasco-92be/raw/len1_cond1_1.csv",
    "examples/physical-pasco-92be/raw/len1_cond1_2.csv",
    "examples/physical-pasco-92be/raw/len1_cond1_3.csv",
    'scripts/browser-predictive-standalone.mjs',
    'src/predictive-selection/select.mjs',
    'src/predictive-selection/session.mjs',
    'src/predictive-selection/panel.mjs',
)
EXCLUDED_COMPONENTS = {
    ".git", "node_modules", ".receipts", "__pycache__", ".cache",
    ".pytest_cache", "dist", "build", "output", "outputs", "coverage",
}
FORBIDDEN_SUFFIXES = {
    ".zip", ".tar", ".gz", ".7z", ".pyc", ".log", ".pem", ".key",
    ".p12", ".pfx", ".sqlite", ".db", ".exe", ".dll", ".so", ".dylib",
}
FORBIDDEN_NAMES = {".env", "credentials", "credentials.json", "secrets.json", "id_rsa", "id_ed25519"}

# Exact tracked historical evidence archives and logs are not distributed.
# Keep these paths explicit; other unapproved archives still fail closed.
NON_DISTRIBUTED_TRACKED_RECEIPTS = frozenset({
    "docs/receipts/applied-torque-760d4cf/full-verify.log.gz",
    "docs/receipts/sensor-response-56bd8a/native-tests.txt",
    "docs/receipts/sensor-response-56bd8a/studio-smoke.txt",
    "docs/receipts/sensor-response-56bd8a/trajectory-smoke.txt",
    "docs/receipts/forward-refinement-269/native-tests.txt",
    "docs/receipts/forward-refinement-269/shared-tests.txt",
    "docs/receipts/command-deadzone-56bd8a/native-tests.txt",
    "docs/receipts/command-deadzone-56bd8a/studio-smoke.txt",
    "docs/receipts/command-deadzone-56bd8a/trajectory-smoke.txt",
    "docs/receipts/metric-plane-4f4650/native-tests.log",
    "docs/receipts/metric-plane-4f4650/thirty-hz-course-refused.log",
    "docs/receipts/branch-response-20261024/native-tests.txt.gz",
    "docs/receipts/prediction-contrast-195c0e2a/authored-inputs-and-notebook.tar.xz",
    "docs/receipts/shared-training-195c0e2a/retained-source-evidence.tar.xz",
    "docs/receipts/periodic-course-a08b/native.log",
    "evidence/composed-reversal-browser.log",
    "evidence/conditional-browser.log",
    "evidence/conditional-core.log",
    "evidence/energy-accounting-8d076f/energy-browser.log",
    "evidence/energy-accounting-8d076f/energy-smoke.log",
    "evidence/energy-accounting-8d076f/energy-tests.log",
    "evidence/energy-accounting-8d076f/independent-root-energy-review.log",
    "evidence/energy-accounting-8d076f/session-tests.log",
    "evidence/energy-accounting-8d076f/torque-tests.log",
    "evidence/rate-dissipation-8d076f/rate-browser.log",
    "evidence/rate-dissipation-8d076f/rate-tests.log",
    "evidence/reversal-browser.log",
})


def git(*args):
    result = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, check=False)
    if result.returncode:
        raise ValueError("Git could not verify source: " + result.stderr.decode("utf-8", "replace").strip())
    return result.stdout


def matches(path, pattern):
    parts, wanted = path.split("/"), pattern.split("/")
    return len(parts) == len(wanted) and all(fnmatch.fnmatchcase(a, b) for a, b in zip(parts, wanted))


def included(path):
    return path not in NON_DISTRIBUTED_TRACKED_RECEIPTS and any(matches(path, pattern) for pattern in INCLUDE)


def check_path(path):
    parts = PurePosixPath(path).parts
    if not parts or path.startswith("/") or any(p in {"", ".", ".."} for p in parts) or "\\" in path:
        raise ValueError(f"Unsafe source path: {path!r}")
    lower = [part.lower() for part in parts]
    name = lower[-1]
    if (any(part in EXCLUDED_COMPONENTS for part in lower)
            or name in FORBIDDEN_NAMES or name.startswith(".env.")
            or name.startswith("id_rsa.") or name.startswith("id_ed25519.")
            or PurePosixPath(name).suffix in FORBIDDEN_SUFFIXES):
        raise ValueError(f"Refusing tracked secret-like or output-artifact path: {path}")


def check_tracked(paths):
    for path in paths:
        if path in NON_DISTRIBUTED_TRACKED_RECEIPTS:
            continue  # Never copied into a release; keep every other rejection intact.
        check_path(path)
        # Repository collaboration configuration is intentionally not distributed.
        if not included(path) and path != ".gitignore" and not path.startswith(".github/"):
            raise ValueError(f"Tracked path is outside the distribution allowlist: {path}")


def tree_entries(commit):
    entries = {}
    for entry in git("ls-tree", "-rz", "--full-tree", commit).split(b"\0"):
        if not entry:
            continue
        metadata, raw_path = entry.split(b"\t", 1)
        mode, kind, object_id = metadata.decode("ascii").split()
        path = raw_path.decode("utf-8")
        entries[path] = (mode, kind, object_id)
    return entries


def collect(args):
    if not args.working_tree:
        if args.expected_tree:
            raise ValueError("--expected-tree requires --working-tree.")
        git("rev-parse", "--verify", args.source_commit + "^{commit}")
        tree = git("rev-parse", args.source_commit + "^{tree}").decode().strip()
        entries = tree_entries(args.source_commit)
        check_tracked(entries)
        files = {}
        for path in sorted(entries):
            if not included(path):
                continue
            mode, kind, object_id = entries[path]
            if mode not in {"100644", "100755"} or kind != "blob":
                raise ValueError(f"Only regular source files may be packaged: {path}")
            files[path] = git("cat-file", "blob", object_id)
        return files, tree, "git-commit", "Verified from the local Git commit object."

    tracked = set(git("ls-files", "-z").decode("utf-8").split("\0")) - {""}
    check_tracked(tracked)
    paths = set()
    for pattern in INCLUDE:
        for path in ROOT.glob(pattern):
            relative = path.relative_to(ROOT).as_posix()
            check_path(relative)
            if not included(relative):
                continue
            # Reject symlinks at every component, including a linked source directory.
            current = ROOT
            for part in PurePosixPath(relative).parts:
                current /= part
                if current.is_symlink():
                    raise ValueError(f"Symbolic links are not distributed: {relative}")
            if not path.is_file():
                raise ValueError(f"Expected a regular source file: {relative}")
            paths.add(relative)
    tree = None
    verification = "Unverified reference commit; bytes are a working-tree candidate."
    mode = "working-tree-candidate"
    if args.expected_tree:
        tree = git("write-tree").decode().strip()
        if tree != args.expected_tree:
            raise ValueError(f"Git index tree {tree} does not match --expected-tree {args.expected_tree}.")
        # Staging is the caller's explicit operation; this script never stages files.
        try:
            git("diff", "--quiet", "--")
        except ValueError as error:
            raise ValueError("Working tree has unstaged changes or could not be verified against the index.") from error
        untracked = paths - tracked
        if untracked:
            raise ValueError("Included source files are not in the verified tree: " + ", ".join(sorted(untracked)))
        entries = tree_entries(tree)
        files = {}
        for path in sorted(paths):
            mode_bits, kind, object_id = entries[path]
            if mode_bits not in {"100644", "100755"} or kind != "blob":
                raise ValueError(f"Only regular source files may be packaged: {path}")
            committed = git("cat-file", "blob", object_id)
            if (ROOT / path).read_bytes() != committed:
                raise ValueError(f"Working bytes differ from the verified tree: {path}")
            files[path] = committed
        return files, tree, "verified-tree", "Caller-supplied remote commit; packaged bytes verified against matching Git tree."
    return {path: (ROOT / path).read_bytes() for path in sorted(paths)}, tree, mode, verification


def commit_pin(value):
    if not re.fullmatch(r"[0-9a-f]{40}", value):
        raise argparse.ArgumentTypeError("Use the full 40-character lowercase Git SHA-1.")
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-commit", required=True, type=commit_pin)
    parser.add_argument("--output", required=True, type=Path, help="New .zip file outside the source directory")
    parser.add_argument("--working-tree", action="store_true", help="Package local files; explicitly labeled candidate unless --expected-tree matches")
    parser.add_argument("--expected-tree", type=commit_pin, help="Independently verified remote Git tree; requires all included files staged and unchanged")
    args = parser.parse_args()
    output = args.output.expanduser().resolve()
    if output.suffix.lower() != ".zip" or output == ROOT or ROOT in output.parents:
        parser.error("--output must be a .zip path outside the source directory.")
    if output.exists():
        parser.error("Output already exists; choose a fresh filename.")
    try:
        files, source_tree, mode, verification = collect(args)
        missing = sorted(set(REQUIRED) - files.keys())
        if missing:
            raise ValueError("Required application files are missing: " + ", ".join(missing))
        manifest = {
            "schema": "worldlaw.source-distribution/v1",
            "product": "WORLDLAW",
            "sourceRepository": "https://github.com/Jacob-Met/worldlaw",
            "sourceCommit": args.source_commit,
            "sourceTree": source_tree,
            "sourceMode": mode,
            "sourceCommitVerification": verification,
            "hashAlgorithm": "SHA-256",
            "files": [{"path": path, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()} for path, data in sorted(files.items())],
            "manifestScope": "Every included source file. This generated manifest does not hash itself; the archive SHA-256 binds it.",
            "runtime": {"node": ">=20", "npmInstallRequired": False, "bundledDependencies": []},
            "archive": {"prefix": "worldlaw/", "compression": "stored", "timestamp": "1980-01-01T00:00:00", "fileMode": "0644"},
        }
        files["SOURCE_MANIFEST.json"] = (json.dumps(manifest, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8")
        output.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(prefix=".worldlaw-package-", suffix=".zip", dir=output.parent, delete=False) as handle:
                temporary = Path(handle.name)
            with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_STORED) as archive:
                for path, data in sorted(files.items()):
                    info = zipfile.ZipInfo("worldlaw/" + path, date_time=(1980, 1, 1, 0, 0, 0))
                    info.create_system = 3
                    info.external_attr = 0o100644 << 16
                    info.compress_type = zipfile.ZIP_STORED
                    archive.writestr(info, data)
            os.replace(temporary, output)
            temporary = None
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
        digest = hashlib.sha256(output.read_bytes()).hexdigest()
        print(json.dumps({"output": str(output), "sha256": digest, "sourceFiles": len(files) - 1, "bytes": output.stat().st_size, "sourceCommit": args.source_commit, "sourceTree": source_tree, "sourceMode": mode}, indent=2))
    except (OSError, UnicodeError, ValueError, subprocess.SubprocessError) as error:
        parser.exit(1, f"Packaging refused: {error}\n")


if __name__ == "__main__":
    main()
