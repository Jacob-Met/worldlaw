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
    "AGENTS.md", "README.md", "LICENSE", "LICENSE.md", "package.json",
    "index.html", "styles.css", "favicon.svg", "server.mjs", "motion.html", "motion.css", "trajectory.html", "trajectory.css",
    "docs/*.md", "docs/*.json", "src/*.mjs", "src/science/*.mjs", "src/motion/*.mjs", "src/trajectory/*.mjs",
    "src/experiment-design/*.mjs", "tests/support/*.mjs",
    "scripts/*.mjs", "scripts/package.py", "scripts/generate-motion-fixtures-15cc.py", "tests/*.test.mjs",
    "examples/*.json", "experiments/active-discovery.mjs",
    "experiments/integral-discovery-92be.mjs", "experiments/integral-stability-92be.mjs",
    "experiments/angular-weak-92be.mjs", "research/PHYSICAL_TELEMETRY_92be.md",
    "experiments/trajectory-planning-92be.mjs", "experiments/trajectory-numerical-qualification.mjs",
    "examples/physical-pasco-92be/README.md", "examples/physical-pasco-92be/LICENSE",
    "examples/physical-pasco-92be/build-bundle.py", "examples/physical-pasco-92be/receive.mjs",
    "examples/physical-pasco-92be/raw/*.csv",
    "evidence/active-discovery-results.json",
    "evidence/derived-telemetry-observations.json",
)
REQUIRED = (
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
    "src/trajectory/data.mjs",
    "src/trajectory/session.mjs",
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


def git(*args):
    result = subprocess.run(["git", "-C", str(ROOT), *args], capture_output=True, check=False)
    if result.returncode:
        raise ValueError("Git could not verify source: " + result.stderr.decode("utf-8", "replace").strip())
    return result.stdout


def matches(path, pattern):
    parts, wanted = path.split("/"), pattern.split("/")
    return len(parts) == len(wanted) and all(fnmatch.fnmatchcase(a, b) for a, b in zip(parts, wanted))


def included(path):
    return any(matches(path, pattern) for pattern in INCLUDE)


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
