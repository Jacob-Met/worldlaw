# Standalone trajectory workbench

The standalone build packages the current trajectory interface, scientific
modules, stylesheet, favicon, and two declared synthetic examples into one HTML
file. Open `.receipts/trajectory-standalone-92be.html` directly in a modern
browser. Using the artifact does not require Node, a server, or a network
connection. It runs the actual model discovery and trajectory calculations in
the browser; no prediction or discovery results are precomputed into the file.

## Rebuild

The packaging script requires Node and an **already installed** esbuild. It
first tries project resolution and the primary runtime's module directory. If
esbuild is installed elsewhere, supply its absolute JavaScript API path:

```sh
ESBUILD_MODULE=/absolute/path/to/esbuild/lib/main.js node scripts/build-trajectory-92be.mjs
```

The script does not install software and adds no application runtime dependency.
The initial receiving build uses esbuild 0.27.3. Its exact module path, module
digest, version, Node version, platform, build options, and source digests are
recorded in `.receipts/trajectory-standalone-92be.manifest.json`.

## What packaging changes

The application entry point is the unchanged `src/trajectory/app.mjs`, bundled
with its actual imports into an inline IIFE. The two current fixture JSON
objects are supplied through the explicit
`globalThis.WORLDLAW_EMBEDDED_EXAMPLES` map, keyed by
`trajectory-pendulum-92be.json` and `trajectory-ambiguous-92be.json`. The app
passes those objects through the same validation, fitting, and forward challenge
path used by its served version. Ordinary application loading still falls back
to fetching the examples when no embedded object is supplied.

The artifact contains inline CSS and a data-URL favicon. The wordmark points to
the workbench in the same file, and the backlink to the separate torque studio
is removed because that page is not included. The served source retains its
normal navigation. The build escapes closing-script sequences and JSON HTML
characters, checks for remaining external scripts/styles/media, and refuses
uncaptured imports or newly introduced external CSS asset references.

## Integrity and reproducibility

Every source byte consumed by the bundler is captured and hashed. Template,
stylesheet, favicon, examples, and the build script are also included in the
source digest list. The manifest records the repository HEAD and the source
files' working-tree status; an uncommitted build is identified as such rather
than being attributed entirely to HEAD. A final release should be rebuilt after
the integration owner freezes and commits the source.

Source digests and build metadata are embedded in an HTML comment. The output
HTML's SHA-256 appears **only in the separate manifest**. The HTML never claims
to contain its own hash. If a captured source changes during bundling, the
script refuses the new artifact and asks for a rebuild. A source digest covers
actual executed inputs; a repository revision alone does not cover uncommitted
changes.

## Receiving and limitations

Receive the generated file in an actual browser with external network requests
blocked. Exercise both examples, alternative models, tolerance updates,
numerical sensitivity, JSON bundle import, notebook download, and notebook
reopen. The existing browser harness supports this mode through
`TRAJECTORY_OFFLINE_FILE`; record the concrete browser run and output digest
alongside release evidence. A successful build alone does not establish a
successful browser receiving pass.

Local browser-storage behavior for a directly opened file varies by browser.
Portable notebook download and reopen are the durable interchange path; the UI
already reports unavailable or full browser storage. This artifact contains the
trajectory workbench only, not the separate torque studio. Its supplied examples
remain synthetic, and its finite-library model comparison, numerical sensitivity,
and sampled tolerance checks do not establish physical validity, unique
mechanism discovery, or calibrated uncertainty.
