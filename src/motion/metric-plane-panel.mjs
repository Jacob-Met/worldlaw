/** A declared reference belongs beside the observed apparatus, not in a separate viewer. */
import {calibratePlaneNotebook} from './measurement.mjs';
import {metricPlaneTemplate} from './metric-plane.mjs';

export function createMetricPlanePanel({root, getNotebook, getTime, isBusy, commit, download, notice, showError, clearError}) {
  const $ = id => root.querySelector('#' + id);
  const input = $('plane-declaration-file');
  let generation = 0;
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
      if (!notebook?.calibration || isBusy()) throw new Error('Finish measuring and set a source pivot before applying a plane.');
      if (file.size > 32_000) throw new Error('A four-point plane declaration must be at most 32 KB.');
      const declaration = JSON.parse(await file.text());
      if (ticket !== generation || notebook !== getNotebook() || isBusy())
        throw new Error('The notebook or acquisition changed while the plane file was being read. Open it again for the current source.');
      const next = calibratePlaneNotebook(notebook, declaration);
      commit(next);
      notice('Declared metric plane applied. The original image points are unchanged; the dashed angle trace retains their image-coordinate interpretation.');
    } catch (error) { showError(error); }
  });
  $('remove-plane-declaration').addEventListener('click', () => {
    clearError();
    generation++;
    try {
      if (isBusy()) throw new Error('Finish measuring before changing the plane.');
      commit(calibratePlaneNotebook(getNotebook(), null));
      notice('Image-coordinate interpretation restored. Previous plane declarations remain in the notebook calibration history.');
    } catch (error) { showError(error); }
  });
  return {
    render() {
      const nb = getNotebook(), plane = nb?.calibration?.plane;
      const identified = /^[a-f0-9]{64}$/i.test(nb?.source?.sha256 || ''), busy = isBusy();
      $('plane-template').disabled = !identified || busy;
      $('open-plane-declaration').disabled = !identified || !nb?.calibration || busy;
      $('remove-plane-declaration').hidden = !plane;
      $('remove-plane-declaration').disabled = busy;
      $('plane-declaration-status').textContent = plane
        ? 'Applied: four declared references at ' + plane.referenceTime.toFixed(3) + ' s, in ' + plane.coordinateUnit
          + '. Zero and rotation now refer to the plane axes. ' + plane.basis
        : identified ? 'Image coordinates are active. A plane is applied only after your complete declaration passes geometric checks.'
          : 'Choose an original video with retained source identity to use a metric-plane calibration.';
      $('plane-declaration-limits').hidden = !plane;
    },
    draw(context, scale = 1) {
      const plane = getNotebook()?.calibration?.plane;
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
