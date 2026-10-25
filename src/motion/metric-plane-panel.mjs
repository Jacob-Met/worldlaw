/** A declared reference belongs beside the observed apparatus, not in a separate viewer. */
import {calibratePlaneNotebook} from './measurement.mjs';
import {admitMetricPlane, metricPlaneTemplate} from './metric-plane.mjs';

export function createMetricPlanePanel({root, getNotebook, getTime, isBusy, commit, changed, download, notice, showError, clearError}) {
  const $ = id => root.querySelector('#' + id);
  const input = $('plane-declaration-file');
  let generation = 0, staged = null;
  function declaration() {
    const nb = getNotebook();
    if (nb?.calibration?.plane) { staged = null; return nb.calibration.plane; }
    if (staged && (staged.source.sha256 !== nb?.source?.sha256?.toLowerCase()
      || staged.source.width !== nb?.source?.width || staged.source.height !== nb?.source?.height)) staged = null;
    return staged;
  }
  $('plane-template').addEventListener('click', () => {
    clearError();
    try { download('worldlaw-metric-plane-template.json', metricPlaneTemplate(getNotebook()?.source, getTime() ?? 0)); }
    catch (error) { showError(error); }
  });
  $('open-plane-declaration').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const file = input.files[0]; input.value = '';
    if (!file) return;
    clearError();
    const ticket = ++generation, notebook = getNotebook();
    try {
      if (!notebook || isBusy()) throw new Error('Choose an original source and finish measuring before changing its plane.');
      if (file.size > 32_000) throw new Error('A four-point plane declaration must be at most 32 KB.');
      const input = JSON.parse(await file.text());
      if (ticket !== generation) return;
      if (notebook !== getNotebook() || isBusy())
        throw new Error('The notebook or acquisition changed while the plane file was being read. Open it again for the current source.');
      const admitted = admitMetricPlane(input, notebook.source).input;
      if (notebook.calibration) {
        const next = calibratePlaneNotebook(notebook, admitted);
        staged = null; commit(next);
        notice('Declared metric plane applied. The original image points are unchanged; the dashed angle trace retains their image-coordinate interpretation.');
      } else {
        staged = admitted; changed();
        notice('Plane declaration staged. Track a marker and compare its rectified path, then explicitly accept a conditional reference. No pivot or angles have been entered. The staged declaration is not saved in the notebook.');
      }
    } catch (error) { if (ticket === generation) showError(error); }
  });
  $('remove-plane-declaration').addEventListener('click', () => {
    clearError();
    generation++;
    try {
      if (isBusy()) throw new Error('Finish measuring before changing the plane.');
      const applied = Boolean(getNotebook()?.calibration?.plane);
      staged = null;
      if (applied) commit(calibratePlaneNotebook(getNotebook(), null)); else changed();
      notice(applied ? 'Image-coordinate interpretation restored. Previous plane declarations remain in the notebook calibration history.'
        : 'Staged plane cleared. Original marker observations remain ready for a separately chosen reference.');
    } catch (error) { showError(error); }
  });
  $('apply-staged-plane').addEventListener('click', () => {
    clearError(); generation++;
    try {
      const nb = getNotebook();
      if (isBusy() || !staged || !nb?.calibration)
        throw new Error('Finish measuring and choose a reference before applying the staged plane.');
      const next = calibratePlaneNotebook(nb, staged);
      staged = null; commit(next);
      notice('The staged plane is now applied to your current reference. Original marker and pivot observations remain unchanged.');
    } catch (error) { showError(error); }
  });
  return {
    declaration,
    cancelPending() { generation++; },
    reset() { generation++; staged = null; },
    render() {
      const nb = getNotebook(), plane = declaration(), applied = Boolean(nb?.calibration?.plane);
      const identified = /^[a-f0-9]{64}$/i.test(nb?.source?.sha256 || ''), busy = isBusy();
      $('plane-template').disabled = !identified || busy;
      $('open-plane-declaration').disabled = !identified || busy;
      $('remove-plane-declaration').hidden = !plane;
      $('remove-plane-declaration').disabled = busy;
      $('remove-plane-declaration').textContent = applied ? 'Return to image angles' : 'Clear staged plane';
      $('apply-staged-plane').hidden = !staged || !nb?.calibration;
      $('apply-staged-plane').disabled = busy;
      $('plane-declaration-status').textContent = plane
        ? (applied ? 'Applied: ' : 'Staged: ') + 'four declared references at ' + plane.referenceTime.toFixed(3) + ' s, in ' + plane.coordinateUnit
          + (applied ? '. Zero and rotation now refer to the plane axes. '
            : nb?.calibration ? '. Your image-coordinate reference remains active. Apply this staged plane to it, or compare the rectified marker path. The staged plane is not saved in the notebook. '
              : '. No angular reference is accepted. Use Compare the rectified path in the reference section; the staged declaration is not saved with an uncalibrated notebook. ') + plane.basis
        : identified ? 'Image coordinates are active. A plane is applied only after your complete declaration passes geometric checks.'
          : 'Choose an original video with retained source identity to use a metric-plane calibration.';
      $('plane-declaration-limits').hidden = !plane;
      $('plane-declaration-limits').textContent = (applied
        ? 'Numbered cyan marks show the declared source references. The solid trace uses the plane; the dashed trace keeps the image interpretation. '
        : 'Numbered cyan marks show the staged source references. This staged plane does not change current angles. ') +
        'Four fitted points do not verify the geometry. Angle-noise estimates exclude calibration-point error, lens distortion and motion outside the plane.';
    },
    draw(context, scale = 1) {
      const plane = declaration();
      if (!plane) return;
      context.save(); context.strokeStyle = '#7ce8f1'; context.fillStyle = '#7ce8f1';
      context.lineWidth = 1.5 * scale; context.font = `${Math.max(10, 12 * scale)}px monospace`;
      plane.pairs.forEach((pair, i) => {
        const {x, y} = pair.image, r = 6 * scale;
        context.beginPath(); context.moveTo(x - r, y); context.lineTo(x + r, y);
        context.moveTo(x, y - r); context.lineTo(x, y + r); context.stroke();
        // Numbered marks identify declared correspondences, not detector output.
        const label = String(i + 1), width = context.measureText(label).width;
        context.fillText(label, Math.max(1, Math.min(context.canvas.width - width - 2, x + r + 3)),
          Math.max(13 * scale, Math.min(context.canvas.height - 3, y - r - 3)));
      });
      context.restore();
    }
  };
}
