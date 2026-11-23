"""Recount the source gate from captured metadata, without scientific data access."""
import hashlib
import json
import sys
from pathlib import Path


def main(root):
    receipts = json.loads((root / "native-originals.json").read_text())
    for item in receipts.values():
        assert item["descendants"] == "drained"
        if "stdout" in item:
            output = item["stdout"].encode()
            assert len(output) == item["output_size"]
            assert hashlib.sha256(output).hexdigest() == item["stdout_sha256"]
    records = [json.loads(line) for line in receipts["version_comparison"]["stdout"].splitlines()]
    assert [str(r["version"]) for r in records] == ["4", "5", "6"]
    assert [r["declared_members"] for r in records] == [26, 31, 33]
    assert [r["archive_bytes"] for r in records] == [21961363, 26721065, 30510742]
    first = json.loads(receipts["archive_v4"]["stdout"])
    assert first["central_sha256"] == records[0]["central_sha256"]
    assert first["top_folders"]["Example data sets"] == 2
    movies = []
    for r in records:
        assert r["physical_files_opened"] == 0
        movies.append({row[0].split("/", 1)[1]: row[1:] for row in r["example_members"]
                       if row[0].endswith(".mp4")})
    platform = "Example data sets/platform_only_30fps.mp4"
    sample = "Example data sets/sample_data.mp4"
    assert movies[0] == {platform: [9605059, 9596946, "bd2e34e9"],
                         sample: [2953137, 2939508, "a45f4f74"]}
    for version in (1, 2):
        assert movies[version][platform] == movies[0][platform]
        assert movies[version][sample] == movies[version]["Software/sample_data.mp4"] == movies[0][sample]
    assert [len(m) for m in movies] == [2, 3, 4]
    assert movies[2]["Software/self_test_video.mp4"] == [3834033, 3787334, "ad9ddedd"]
    assert [receipts[k]["exit_code"] for k in ("software_inspection", "independent_archive_reader")] == [1, 1]
    procedure = json.loads(receipts["procedure"]["stdout"])
    assert sum("10 degrees" in line for line in procedure["source_lines"]) == 2
    print(json.dumps({"catalog_entries": [26, 31, 33], "movie_entries": [2, 3, 4],
                      "v4_named_example_movies": sorted(movies[0]), "physical_comparisons": 0,
                      "eligible_independent_reference_runs_verified": 0}, sort_keys=True))


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent)
