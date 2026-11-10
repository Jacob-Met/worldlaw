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
// Keep a real, complete top-level consumer declaration. In today's Studio,
// updateHud lies between renderModel and render; executing all declarations
// through render in a VM also executes unrelated document-binding initialization.
function declaration(name) {
  const first = app.indexOf('function ' + name + '(');
  assert.ok(first >= 0, 'Maintained ' + name + ' function missing');
  const remaining = app.slice(first);
  const next = remaining.search(/\nfunction [A-Za-z_$][\w$]*\(/);
  assert.ok(next > 0, 'Maintained ' + name + ' boundary missing');
  return remaining.slice(0, next);
}
const retire = declaration('retireLocalResponse');
const render = declaration('renderModel');
assert.ok(render.indexOf('retireLocalResponse(') < render.indexOf('clockPanel?.studioChanged()'));
assert.ok(render.indexOf('clockPanel?.studioChanged()') < render.indexOf('affinePanel?.studioChanged()'));

for (const failingView of ['clock', 'affine']) {
  test('a refused ' + failingView + ' view cannot retain the previously inspected law response', () => {
    const calls = [];
    let visibleResponse = 'previous law';
    const context = {
      balanceInspection:{retire() {calls.push('balance-retire');}},
      modelId:'newly selected law', localResponseCourse:{previous:true},
      localResponse:{retire() {calls.push('retire'); visibleResponse = null;}},
      clockPanel:{studioChanged() {calls.push('clock'); if (failingView === 'clock') throw Error('controlled clock refusal');}},
      affinePanel:{studioChanged() {calls.push('affine'); if (failingView === 'affine') throw Error('controlled affine refusal');}},
    };
    assert.throws(() => vm.runInNewContext(retire + '\n' + render + '\nrenderModel();', context),
      new RegExp('controlled ' + failingView + ' refusal'));
    assert.equal(context.localResponseCourse, null);
    assert.equal(visibleResponse, null);
    assert.deepEqual(calls, failingView === 'clock' ? ['balance-retire', 'retire', 'clock'] : ['balance-retire', 'retire', 'clock', 'affine']);
  });
}
