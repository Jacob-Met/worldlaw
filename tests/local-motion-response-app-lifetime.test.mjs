import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

// Execute the maintained consumer functions themselves. The diagnostic views
// deliberately throw before the rest of the renderer can execute; this is a
// retirement-order control, not a substitute for the real browser course.
const app = await readFile(process.env.WORLDLAW_APP_LIFETIME_SOURCE ||
  fileURLToPath(new URL('../src/app.mjs', import.meta.url)), 'utf8');
function between(start, end) {
  const first = app.indexOf(start), last = app.indexOf(end, first);
  assert.ok(first >= 0 && last > first, 'Maintained renderer boundary missing');
  return app.slice(first, last);
}
const retire = between('function retireLocalResponse(', '\nfunction alertError(');
const render = between('function renderModel(', '\nfunction render(){');

for (const failingView of ['clock', 'affine']) {
  test('a refused ' + failingView + ' view cannot retain the previously inspected law response', () => {
    const calls = [];
    let visibleResponse = 'previous law';
    const context = {
      modelId:'newly selected law', localResponseCourse:{previous:true},
      localResponse:{retire() {calls.push('retire'); visibleResponse = null;}},
      clockPanel:{studioChanged() {calls.push('clock'); if (failingView === 'clock') throw Error('controlled clock refusal');}},
      affinePanel:{studioChanged() {calls.push('affine'); if (failingView === 'affine') throw Error('controlled affine refusal');}},
    };
    assert.throws(() => vm.runInNewContext(retire + '\n' + render + '\nrenderModel();', context),
      new RegExp('controlled ' + failingView + ' refusal'));
    assert.equal(context.localResponseCourse, null);
    assert.equal(visibleResponse, null);
    assert.deepEqual(calls, failingView === 'clock' ? ['retire', 'clock'] : ['retire', 'clock', 'affine']);
  });
}
