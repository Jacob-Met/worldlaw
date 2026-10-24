# Browser admission helper provenance

`chromium-sandbox.mjs` is an exact vendored snapshot of HAMON's maintained
same-browser Linux Chromium admission helper (#1490 lineage). Keep changes to
its parser and admission policy with HAMON; refresh this test-only snapshot
deliberately rather than creating a product-specific sandbox parser.

This copy was received through EXPERIMENTAL EARTH at commit
`3f3b5aba95688b2ac5b92f33d7cac0beb7624c6e`, path
`tests/support/chromium-sandbox.mjs`, Git blob
`74448e8878dcf285267467b74984121dd897c25c`.
SHA-256: `4607c67b360596ee06b36e41a6b5d3a8a6da70defb04292d955f609dcef05ead`.
The source repository's `tests/support/README.md` identifies its maintained
HAMON origin. No source bytes have been changed here.

The caller supplies an owned Puppeteer CDP page before navigating to the
product. The helper observes that browser's `chrome://sandbox` status and
refuses absent/ambiguous/inactive protections, without changing launch flags.
A successful process launch, or a claimed `sandboxDisabled: false` field,
is not evidence of admission. The course receiver retains both the raw status
and parsed admission checks, including refusal receipts, and owns cleanup of
its browser. Use the installed direct binary, by default
`/usr/bin/google-chrome-stable`; do not substitute a wrapper whose flags disable
the sandbox. This helper is not part of the shipped product runtime.
