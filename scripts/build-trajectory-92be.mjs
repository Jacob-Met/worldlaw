#!/usr/bin/env node
/** Package the actual trajectory application as one offline HTML file. */
import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const root = resolve(dirname(scriptPath), '..');
const outputPath = join(root, '.receipts/trajectory-standalone-92be.html');
const manifestPath = join(root, '.receipts/trajectory-standalone-92be.manifest.json');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const portablePath = path => relative(root, path).split(sep).join('/');
const snapshots = new Map();
async function snapshot(path) {
  const absolute = resolve(path);
  if (absolute !== root && !absolute.startsWith(root + sep)) throw new Error(`Source outside project: ${absolute}`);
  if (!snapshots.has(absolute)) snapshots.set(absolute, await readFile(absolute));
  return snapshots.get(absolute);
}

async function installedEsbuild() {
  const specified = process.env.ESBUILD_MODULE;
  if (specified && !isAbsolute(specified)) throw new Error('ESBUILD_MODULE must be an absolute path to an installed esbuild JavaScript module.');
  const candidates = [];
  if (specified) candidates.push(specified);
  else {
    try { candidates.push(createRequire(import.meta.url).resolve('esbuild')); } catch {}
    if (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) {
      candidates.push(join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'esbuild/lib/main.js'));
    }
  }
  for (const candidate of [...new Set(candidates)]) {
    try { await access(candidate); } catch { continue; }
    const imported = await import(pathToFileURL(candidate).href);
    const api = typeof imported.build === 'function' ? imported : imported.default;
    if (typeof api?.build !== 'function' || typeof api.version !== 'string') throw new Error(`Not an esbuild API module: ${candidate}`);
    return { api, modulePath: candidate, moduleSHA256: hash(await readFile(candidate)) };
  }
  throw new Error('No installed esbuild found. Set ESBUILD_MODULE to its absolute lib/main.js path; this script never installs dependencies.');
}

function replaceExactlyOnce(text, pattern, replacement, label) {
  let count = 0;
  const result = text.replace(pattern, (...args) => { count++; return typeof replacement === 'function' ? replacement(...args) : replacement; });
  if (count !== 1) throw new Error(`Expected one ${label}, found ${count}; inspect the current HTML template.`);
  return result;
}
function safeInlineJSON(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
function safeScript(code) {
  // The HTML raw-text parser recognizes closing tags even inside JS strings.
  return code.replace(/<\/script/gi, '<\\/script');
}
function git(...args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { return null; }
}

async function main() {
  const { api: esbuild, modulePath, moduleSHA256 } = await installedEsbuild();
  const assetPaths = ['trajectory.html', 'trajectory.css', 'favicon.svg',
    'examples/trajectory-pendulum-92be.json', 'examples/trajectory-ambiguous-92be.json'];
  const assets = new Map(await Promise.all(assetPaths.map(async name => [name, await snapshot(join(root, name))])));
  await snapshot(scriptPath);
  const htmlTemplate = assets.get('trajectory.html').toString('utf8');
  const css = assets.get('trajectory.css').toString('utf8');
  if (/@import\b|url\s*\(/i.test(css)) throw new Error('The standalone stylesheet now contains asset references; embed them explicitly before rebuilding.');
  if (/<\/style/i.test(css)) throw new Error('The standalone stylesheet contains an HTML closing-style sequence.');
  const exampleNames = ['trajectory-pendulum-92be.json', 'trajectory-ambiguous-92be.json'];
  const examples = Object.fromEntries(exampleNames.map(name => [name, JSON.parse(assets.get(`examples/${name}`).toString('utf8'))]));
  for (const [name, value] of Object.entries(examples)) {
    if (!value || Array.isArray(value) || value.schema !== 'worldlaw.trajectory-bundle/v1') throw new Error(`Unexpected embedded example schema: ${name}`);
  }

  const build = await esbuild.build({
    absWorkingDir: root, entryPoints: ['src/trajectory/app.mjs'],
    bundle: true, write: false, metafile: true,
    format: 'iife', platform: 'browser', target: ['es2022'],
    charset: 'utf8', legalComments: 'inline', minify: false, sourcemap: false,
    logLevel: 'silent',
    plugins: [{ name: 'worldlaw-exact-source-snapshot', setup(builder) {
      builder.onLoad({ filter: /\.mjs$/, namespace: 'file' }, async ({ path }) => ({
        contents: (await snapshot(path)).toString('utf8'), loader: 'js', resolveDir: dirname(path),
      }));
    } }],
  });
  if (build.outputFiles.length !== 1) throw new Error('Expected exactly one JavaScript bundle.');
  for (const [name, output] of Object.entries(build.metafile.outputs)) {
    if (output.imports.length) throw new Error(`Standalone bundle retained external imports: ${name}`);
  }
  for (const input of Object.keys(build.metafile.inputs)) {
    if (!snapshots.has(resolve(root, input))) throw new Error(`Bundled input was not captured for source attribution: ${input}`);
  }
  const appSource = (await snapshot(join(root, 'src/trajectory/app.mjs'))).toString('utf8');
  if (!appSource.includes('WORLDLAW_EMBEDDED_EXAMPLES')) throw new Error('The application does not yet contain its explicit embedded-example hook.');
  const bundleText = build.outputFiles[0].text;
  const boot = safeScript(`globalThis.WORLDLAW_EMBEDDED_EXAMPLES = ${safeInlineJSON(examples)};\n${bundleText}`);
  const sources = [...snapshots].map(([path, bytes]) => ({ path: portablePath(path), bytes: bytes.byteLength, sha256: hash(bytes) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const sourceHead = git('rev-parse', 'HEAD');
  const sourceStatus = git('status', '--porcelain=v1', '--', ...sources.map(source => source.path));
  const buildInfo = {
    schema: 'worldlaw.trajectory-standalone-build/v1',
    sourceHead, sourceStatus,
    sourceMeaning: 'Source digests identify exact bytes bundled; sourceHead alone does not include uncommitted changes.',
    tool: { name: 'esbuild', version: esbuild.version, modulePath, moduleSHA256, node: process.version, platform: process.platform, architecture: process.arch },
    entryPoint: 'src/trajectory/app.mjs', format: 'iife', target: 'es2022',
    embeddedExamples: exampleNames, sources,
    scope: 'Actual finite-library trajectory discovery, forward prediction, numerical sensitivity and sampled error comparison; synthetic examples, no physical validation claim.',
  };

  let html = replaceExactlyOnce(htmlTemplate, /<link\b[^>]*\brel="stylesheet"[^>]*>/gi,
    tag => {
      if (!/\bhref="\/trajectory\.css"/.test(tag)) throw new Error('Unexpected stylesheet reference.');
      return `<style id="worldlaw-standalone-styles">\n${css}\n</style>`;
    }, 'trajectory stylesheet link');
  html = replaceExactlyOnce(html, /<link\b[^>]*\brel="icon"[^>]*>/gi,
    `<link rel="icon" href="data:image/svg+xml;base64,${assets.get('favicon.svg').toString('base64')}" type="image/svg+xml">`, 'favicon link');
  html = replaceExactlyOnce(html, /<script\b[^>]*\bsrc="\/src\/trajectory\/app\.mjs"[^>]*>\s*<\/script>/gi,
    `<script id="worldlaw-standalone-app">\n${boot}\n</script>`, 'application module script');
  // A standalone trajectory file cannot navigate to the separate hosted torque studio.
  html = replaceExactlyOnce(html, /<a\b(?=[^>]*\bclass="wordmark")(?=[^>]*\bhref="\/index\.html")[^>]*>/gi,
    tag => tag.replace('href="/index.html"', 'href="#workbench"').replace('aria-label="WORLDLAW torque studio"', 'aria-label="WORLDLAW trajectory workbench"'), 'wordmark link');
  html = replaceExactlyOnce(html, /<a\b[^>]*\bclass="studio-link"[^>]*>[\s\S]*?<\/a>/gi,
    '', 'unavailable torque-studio backlink');
  const commentJSON = JSON.stringify(buildInfo).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/--/g, '\\u002d\\u002d');
  html = html.replace('</head>', `<!-- WORLDLAW_STANDALONE_BUILD ${commentJSON} -->\n</head>`);
  if (/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\brel="stylesheet"/i.test(html)) throw new Error('External script or stylesheet reference survived packaging.');
  if (/<(?:img|iframe|audio|video|source)\b[^>]*\bsrc="(?!data:)/i.test(html)) throw new Error('An external media reference survived packaging.');
  if ((html.match(/<\/script\s*>/gi) ?? []).length !== 1) throw new Error('Unexpected closing-script sequence in generated HTML.');

  // Concurrent source editing is allowed in the studio, but not in a receipt:
  // refuse to publish a mixture if a captured input changed during this build.
  for (const [path, bytes] of snapshots) {
    if (!bytes.equals(await readFile(path))) throw new Error(`Source changed during packaging; rebuild after edits finish: ${portablePath(path)}`);
  }
  const manifest = { ...buildInfo, output: { path: portablePath(outputPath), bytes: Buffer.byteLength(html), sha256: hash(html) },
    integrityMeaning: 'Output SHA-256 is recorded only in this separate manifest; the HTML does not contain or claim its own hash.',
    buildCommand: 'ESBUILD_MODULE=/absolute/path/to/esbuild/lib/main.js node scripts/build-trajectory-92be.mjs',
    warnings: build.warnings.map(warning => warning.text) };
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryHTML = `${outputPath}.${process.pid}.tmp`, temporaryManifest = `${manifestPath}.${process.pid}.tmp`;
  await writeFile(temporaryHTML, html);
  await writeFile(temporaryManifest, JSON.stringify(manifest, null, 2) + '\n');
  await rename(temporaryHTML, outputPath);
  await rename(temporaryManifest, manifestPath);
  console.log(JSON.stringify({ output: portablePath(outputPath), manifest: portablePath(manifestPath),
    bytes: manifest.output.bytes, sha256: manifest.output.sha256, sourceHead, sourceCount: sources.length, esbuild: esbuild.version }, null, 2));
}

main().catch(error => { console.error(`Standalone build failed: ${error.message}`); process.exitCode = 1; });
