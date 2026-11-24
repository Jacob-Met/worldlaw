#!/usr/bin/env python3
"""Read the retained original course. Never regenerate or retune observations."""
import argparse
import hashlib
import io
import json
import math
import os
from pathlib import Path
import resource
import urllib.error
import urllib.request
import zipfile

REPO = "Jacob-Met/worldlaw"
RUN = 45303778005
ARTIFACT = 14879722662
ZIP_BYTES = 12329535
ZIP_SHA = "9c48ca7a88d8b47601eb4b9e4467a655b9d7bdc488eaeaf586fdcdade70e8bdd"
REPORT_SHA = "ba1d9919669b62e63181d37fa4a4a7aaf396026b63f9d76974f7c840583b5e78"
PROTOCOL_SHA = "9afddeabd61994edda8fe0b0d07517c9ddff1b2d77dae5417370207ca931538b"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def download(path):
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN with original-repository Actions read access is required")
    base = f"https://api.github.com/repos/{REPO}/actions/artifacts/{ARTIFACT}"
    headers = {"Accept": "application/vnd.github+json", "Authorization": "Bearer " + token,
               "X-GitHub-Api-Version": "2022-11-28"}
    with urllib.request.urlopen(urllib.request.Request(base, headers=headers), timeout=30) as response:
        metadata = json.load(response)
    assert metadata["id"] == ARTIFACT
    assert metadata["workflow_run"]["id"] == RUN
    assert metadata["size_in_bytes"] == ZIP_BYTES
    assert metadata["digest"] == "sha256:" + ZIP_SHA
    request = urllib.request.Request(base + "/zip", headers=headers)
    try:
        response = urllib.request.build_opener(NoRedirect()).open(request, timeout=30)
    except urllib.error.HTTPError as error:
        if error.code not in (301, 302, 303, 307, 308):
            raise
        location = error.headers["Location"]
        if not location.startswith("https://"):
            raise RuntimeError("Refuse non-HTTPS artifact redirect")
        # Repository credentials are never forwarded to the storage host.
        response = urllib.request.urlopen(location, timeout=60)
    total = 0
    with response, path.open("wb") as target:
        while True:
            block = response.read(1024 * 1024)
            if not block:
                break
            total += len(block)
            if total > ZIP_BYTES:
                raise RuntimeError("Original archive exceeded its frozen byte count")
            target.write(block)


def admitted(row, arm, version):
    return row["arms"][arm][version]["admitted"] and not row["memory"]["contradiction"]


def correct(row, arm, version):
    return not row["outside"] and admitted(row, arm, version) and row["arms"][arm][version]["law"] == row["id"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    affinity = os.sched_getaffinity(0)
    os.sched_setaffinity(0, {min(affinity)})
    resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
    args.output.mkdir(parents=True, exist_ok=True)
    args.archive.parent.mkdir(parents=True, exist_ok=True)
    if args.download:
        download(args.archive)
    archive_bytes = args.archive.read_bytes()
    assert len(archive_bytes) == ZIP_BYTES
    assert hashlib.sha256(archive_bytes).hexdigest() == ZIP_SHA
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        names = archive.namelist()
        report_names = [name for name in names if name == "report.json"]
        assert len(report_names) == 1
        raw = archive.read(report_names[0])
        assert hashlib.sha256(raw).hexdigest() == REPORT_SHA
        report = json.loads(raw)
        assert report["status"] == "complete"
        assert report["protocolSha256"] == PROTOCOL_SHA
        assert len(report["rows"]) == 144
        changed = []
        wrong = []
        by_snr = []
        for row in report["rows"]:
            if row["outside"]:
                continue
            for arm in ("contender", "committee", "random", "passive"):
                old, new = row["arms"][arm]["legacy"], row["arms"][arm]["prefix"]
                assert old["law"] == new["law"] and old["coef"] == new["coef"]
                before, after = correct(row, arm, "legacy"), correct(row, arm, "prefix")
                record = {"family": row["id"], "seed": row["seed"], "db": row["db"], "arm": arm,
                          "selected": new["law"], "coefficients": new["coef"],
                          "oldCorrect": before, "newCorrect": after,
                          "oldError": old["standardizedError"], "newError": new["standardizedError"],
                          "prefixLossBefore": new["prefix"]["lossBefore"],
                          "prefixLossAfter": new["prefix"]["lossAfter"],
                          "prefixStop": new["prefix"]["stopReason"]}
                if before != after:
                    changed.append(record)
                if admitted(row, arm, "prefix") and new["law"] != row["id"]:
                    wrong.append(record)
        for db in (15, 25, 40):
            rows = [row for row in report["rows"] if not row["outside"] and row["db"] == db]
            assert len(rows) == 44
            by_snr.append({"db": db, "denominator": 44, "arms": {
                arm: {version: {"correct": sum(correct(row, arm, version) for row in rows),
                                "wrong": sum(admitted(row, arm, version) and not correct(row, arm, version) for row in rows)}
                      for version in ("legacy", "prefix")}
                for arm in ("contender", "committee", "random", "passive")}})
    result = {"schema": "worldlaw-prefix-original-diagnostic/v1",
              "sourceRun": RUN, "sourceArtifact": ARTIFACT, "zipBytes": ZIP_BYTES,
              "zipSha256": ZIP_SHA, "reportSha256": REPORT_SHA, "protocolSha256": PROTOCOL_SHA,
              "sourceCommit": report["commit"], "environment": report["environment"],
              "originalResourceUsage": report["resourceUsage"],
              "primary": report["primary"], "estimatorGate": report["estimatorGate"],
              "scores": report["scores"], "paired": report["paired"],
              "changed": changed, "wrong": wrong, "bySnr": by_snr,
              "inspectionBudget": {"cpuAffinity": sorted(os.sched_getaffinity(0)),
                                   "perProcessAddressSpaceBytes": 512 * 1024 * 1024,
                                   "maxRssKiB": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss},
              "scope": "Retrospective inspection of one frozen original archive; no new acquisition, fit, score cohort or tuning"}
    (args.output / "diagnostic.json").write_text(json.dumps(result, indent=2) + "\n")
    (args.output / "original-report.json").write_bytes(raw)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
