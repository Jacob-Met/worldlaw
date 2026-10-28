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
// Preserve the separately received synthetic-only and measured-angular revisions.
const outputPath = join(root, '.receipts/trajectory-experiment-screened-standalone-92be.html');
const manifestPath = join(root, '.receipts/trajectory-experiment-screened-standalone-92be.manifest.json');
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
function safeHTML(text) {
  return String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function git(...args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
  catch { return null; }
}

async function main() {
  const { api: esbuild, modulePath, moduleSHA256 } = await installedEsbuild();
  const assetPaths = ['trajectory.html', 'trajectory.css', 'favicon.svg',
    'examples/trajectory-pendulum-92be.json', 'examples/trajectory-ambiguous-92be.json',
    'examples/physical-pasco-92be.json', 'examples/physical-pasco-92be/LICENSE'];
  const assets = new Map(await Promise.all(assetPaths.map(async name => [name, await snapshot(join(root, name))])));
  await snapshot(scriptPath);
  const htmlTemplate = assets.get('trajectory.html').toString('utf8');
  const css = assets.get('trajectory.css').toString('utf8');
  if (/@import\b|url\s*\(/i.test(css)) throw new Error('The standalone stylesheet now contains asset references; embed them explicitly before rebuilding.');
  if (/<\/style/i.test(css)) throw new Error('The standalone stylesheet contains an HTML closing-style sequence.');
  const exampleNames = ['trajectory-pendulum-92be.json', 'trajectory-ambiguous-92be.json', 'physical-pasco-92be.json'];
  const examples = Object.fromEntries(exampleNames.map(name => [name, JSON.parse(assets.get(`examples/${name}`).toString('utf8'))]));
  for (const [name, value] of Object.entries(examples)) {
    const expectedSchema = name === 'physical-pasco-92be.json' ? 'worldlaw.angular-bundle/v1' : 'worldlaw.trajectory-bundle/v1';
    if (!value || Array.isArray(value) || value.schema !== expectedSchema) throw new Error(`Unexpected embedded example schema: ${name}`);
  }
  const measured = examples['physical-pasco-92be.json'];
  const measuredRuns = [...measured.trainingRuns, ...measured.challengeRuns];
  const datasetSource = measuredRuns[0]?.source;
  if (measured.trainingRuns.length !== 2 || measured.challengeRuns.length !== 1 ||
    datasetSource?.repository !== 'https://github.com/EnzeXu/Damped_Pendulum_Dataset' ||
    !/^[a-f0-9]{40}$/.test(datasetSource.revision) ||
    measuredRuns.some(run => run.source?.repository !== datasetSource.repository ||
      run.source?.revision !== datasetSource.revision || run.source?.license !== 'Apache-2.0')) {
    throw new Error('Measured example attribution changed; review the embedded dataset source notice before rebuilding.');
  }
  const datasetLicensePath = 'examples/physical-pasco-92be/LICENSE';
  const datasetLicenseBytes = assets.get(datasetLicensePath);
  const datasetLicense = datasetLicenseBytes.toString('utf8');
  if (!datasetLicense.includes('Apache License') || !datasetLicense.includes('Version 2.0, January 2004') ||
    !datasetLicense.includes('END OF TERMS AND CONDITIONS')) throw new Error('Expected the complete original Apache 2.0 dataset license.');
  const licenseDisclosure = `<details id="dataset-license" class="standalone-license"><summary>Measured-data source and Apache 2.0 license</summary>
<div class="standalone-license-body"><p>The measured PASCO pendulum recordings are from the <a href="${safeHTML(datasetSource.repository)}">Damped Pendulum Dataset</a>, provided by Enze Xu and collaborators for <em>Identifying Invariant Physical Dynamics Across Multiple Environments</em>. Source revision: <code>${safeHTML(datasetSource.revision)}</code>.</p>
<p>WORLDLAW modified the source into a JSON selection of original seconds 5–25 from recordings 1, 2, and 3 of length group 1, air condition 1. Recorded positions and timestamps remain unchanged. Recordings 1 and 2 train the model; recording 3 supplies a separate prediction comparison. The supplied starting rates come from the original sensor channel. This benchmark has been reused during method development; it is not new blind validation. Physical inertia and absolute torque remain unknown.</p>
<p>The original CSV files, extraction script, and complete provenance remain in the source repository. This standalone file embeds the selected JSON, its per-run source metadata, and the complete original dataset license below. The license applies to the dataset; it does not claim ownership of the WORLDLAW application.</p>
<pre class="standalone-license-text" tabindex="0" aria-label="Complete Apache License 2.0 dataset license">${safeHTML(datasetLicense)}</pre></div></details>`;
  const licenseCSS = '\n.standalone-license{margin:1.25rem 0;padding:1rem 0;border-top:1px solid #d9dece;font-size:.85rem;color:#425b4b}.standalone-license summary{cursor:pointer;font-weight:650}.standalone-license-body{max-width:65rem;line-height:1.65}.standalone-license-body a{text-decoration:underline}.standalone-license-body code{overflow-wrap:anywhere}.standalone-license-text{white-space:pre-wrap;overflow-wrap:anywhere;max-height:28rem;overflow:auto;padding:1rem;background:#f7f8f1;border:1px solid #d9dece;border-radius:.4rem;font-size:.75rem;line-height:1.5}.standalone-license-text:focus-visible,.standalone-license summary:focus-visible{outline:2px solid #315b48;outline-offset:4px}\n';

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
    datasetAttribution: { repository: datasetSource.repository, revision: datasetSource.revision,
      license: 'Apache-2.0', licensePath: datasetLicensePath, licenseSHA256: hash(datasetLicenseBytes),
      disclosureId: 'dataset-license', fullLicenseEmbedded: true, originalCSVFilesEmbedded: false },
    experiment: {instrumentId:'worldlaw.virtual-pendulum/v1',kind:'synthetic',
      planning:'Training-ranked competitive predictions only; RMS pairwise position disagreement, sampled state limits.',
      numericalScreen:'Shared PR7 qualifier checks retained designs/models at the stated step and half step before new acquisition. Existing recorded evidence remains usable. The 750,000-step screen allowance is separate from the 250,000-step planner allowance; two-step agreement is not convergence or an accuracy bound.',
      acquisition:'Separate fixed-equation fine-step virtual instrument; explicit application before training changes.',
      reopening:'Input-based replay with exact protocol/source identity, position-only 64-epsilon roundoff allowance, and preserved supplied observations.',
      evaluation:'The same reserved recording is compared before and after refitting; exploratory reuse is not fresh blind validation.'},
    recordedExperiment: {schema:'worldlaw.recorded-trajectory-experiment/v1',
      scope:'Explicitly known-inertia recordings in the original supported torque family; angular-only inputs and extended model families keep their existing workflows.',
      receiving:'Separately supplied source recording with declared provenance, matching known inertia and constant command; no instrument is operated and source declarations are not authenticated.',
      predictions:'Original planned forecasts remain separate from frozen-model replays at supplied initial conditions and original timestamps. Observed later positions do not fit those forecasts or gate admission by agreement.',
      application:'Receipt remains pending until explicit application; worse and failed revisions remain retained against the same reserved evaluation recording.',
      reopening:'Input-only recorded history retains the exact original virtual notebook, source observations and explicit refit events; predictions are recomputed, not trusted from saved answers.',
      limits:'The complete actual-clock forecast comparison has a separate 750,000-step budget. A refused forecast does not discard supplied evidence. User-declared measurements and reused evaluation are not authenticated acquisition or fresh blind validation.'},
    scope: 'Actual finite-library trajectory and angular-acceleration discovery, independent synthetic experiment planning/acquisition/refitting, separately supplied known-inertia recorded outcomes, free forward prediction, numerical sensitivity and sampled error comparison; two synthetic examples plus separately recorded PASCO measurements with unknown physical torque scale. Virtual acquisitions are synthetic. The recorded workflow imports user-supplied evidence without operating or authenticating a physical instrument, and does not add known inertia to the PASCO angular recordings. Reused evaluation, finite-library alternatives and retained refit failures do not establish unique structure or general physical-law discovery.',
  };

  let html = replaceExactlyOnce(htmlTemplate, /<link\b[^>]*\brel="stylesheet"[^>]*>/gi,
    tag => {
      if (!/\bhref="\/trajectory\.css"/.test(tag)) throw new Error('Unexpected stylesheet reference.');
      return `<style id="worldlaw-standalone-styles">\n${css}${licenseCSS}</style>`;
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
  html = replaceExactlyOnce(html, /<footer\b[^>]*\bclass="page-footer"[^>]*>/gi,
    tag => `${licenseDisclosure}\n${tag}`, 'footer for dataset license disclosure');
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
