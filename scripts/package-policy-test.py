#!/usr/bin/env python3
"""Check the maintained distribution policy in a source checkout (Python + Git)."""

import argparse
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("worldlaw_package", Path(__file__).with_name("package.py"))
package = importlib.util.module_from_spec(spec)
spec.loader.exec_module(package)


class DistributionPolicyTests(unittest.TestCase):
    def test_current_tracked_tree_has_explicit_coverage(self):
        paths = set(package.git("ls-files", "-z").decode("utf-8").split("\0")) - {""}
        self.assertTrue(paths, "Run from a populated source checkout")
        package.check_tracked(paths)
        for path in package.REQUIRED:
            with self.subTest(path=path):
                self.assertIn(path, paths)
                self.assertTrue(package.included(path))

    def test_runtime_dependencies_and_test_fixtures_are_distributed(self):
        for path in (
            "motion-reference.html", "motion-reference.css", "src/motion/reference-app.mjs",
            "src/motion/vendor/mechanism-core.mjs", "src/motion/vendor/mechanism-source.json",
            "src/motion/vendor/reference-admission.mjs", "src/motion/vendor/reference-source.json",
            "scripts/support/README.md", "scripts/support/chromium-sandbox.mjs",
            "tests/coupling-shared-course-fixture.mjs", "tests/response-contrast-fixture.mjs",
            "tests/fixtures/command-response-moments.json",
        ):
            with self.subTest(path=path):
                package.check_tracked([path])
                self.assertTrue(package.included(path))

    def test_exact_historical_outputs_are_omitted_without_reading_them(self):
        # A real Git-object collection must read only the allowed source blob.
        source = "src/app.mjs"
        entries = {source: ("100644", "blob", "source-blob")}
        entries.update({path: ("100644", "blob", "never-read")
                        for path in package.NON_DISTRIBUTED_TRACKED_RECEIPTS})
        reads = []

        def git(*args):
            if args[:2] == ("cat-file", "blob"):
                reads.append(args[2])
                self.assertEqual(args[2], "source-blob")
                return b"export const received = true;\n"
            if args[0] == "rev-parse":
                return b"a" * 40 + b"\n"
            self.fail("Unexpected Git operation: " + repr(args))

        args = argparse.Namespace(working_tree=False, expected_tree=None, source_commit="a" * 40)
        with patch.object(package, "git", git), patch.object(package, "tree_entries", return_value=entries):
            files, _, mode, _ = package.collect(args)
        self.assertEqual(set(files), {source})
        self.assertEqual(reads, ["source-blob"])
        self.assertEqual(mode, "git-commit")
        for path in package.NON_DISTRIBUTED_TRACKED_RECEIPTS:
            with self.subTest(path=path):
                self.assertFalse(package.included(path))
                package.check_tracked([path])
                # Exceptions bind an exact path, not an extension or directory.
                other = str(Path(path).with_name("copy-" + Path(path).name))
                with self.assertRaises(ValueError):
                    package.check_tracked([other])
                with self.assertRaises(ValueError):
                    package.check_tracked([path.upper()])

    def test_unknown_outputs_secrets_and_traversal_still_refuse(self):
        for path in (
            "another-root-document.md", "docs/verification/unreviewed.json",
            "src/motion/vendor/unreviewed.mjs", "evidence/another.log",
            "evidence/energy-accounting-8d076f/another.log", "docs/receipts/new/archive.gz",
            "src/science/.env", "src/science/.env.local", "src/science/credentials.json",
            "src/science/id_ed25519", "src/science/private.pem", "src/output/generated.mjs",
            "src/../app.mjs", "/src/app.mjs", "src\\app.mjs",
            ".github/workflows/private.key",
        ):
            with self.subTest(path=path), self.assertRaises(ValueError):
                package.check_tracked([path])

    def test_repository_configuration_stays_outside_distribution(self):
        for path in (".gitignore", ".github/PULL_REQUEST_TEMPLATE.md"):
            package.check_tracked([path])
            self.assertFalse(package.included(path))

    def test_working_tree_symlinks_refuse_at_file_and_directory(self):
        args = argparse.Namespace(working_tree=True, expected_tree=None, source_commit="a" * 40)
        for linked_directory in (False, True):
            with self.subTest(linked_directory=linked_directory), tempfile.TemporaryDirectory() as folder:
                base = Path(folder)
                root, outside = base / "checkout", base / "outside"
                root.mkdir()
                outside.mkdir()
                (outside / "app.mjs").write_text("export const fixture = true;\n")
                try:
                    if linked_directory:
                        (root / "src").symlink_to(outside, target_is_directory=True)
                    else:
                        (root / "src").mkdir()
                        (root / "src/app.mjs").symlink_to(outside / "app.mjs")
                except (OSError, NotImplementedError) as error:
                    self.skipTest("Host cannot create test symlinks: " + str(error))
                with patch.object(package, "ROOT", root), patch.object(package, "git", return_value=b"src/app.mjs\0"):
                    with self.assertRaisesRegex(ValueError, "Symbolic links"):
                        package.collect(args)


if __name__ == "__main__":
    unittest.main(verbosity=2)
