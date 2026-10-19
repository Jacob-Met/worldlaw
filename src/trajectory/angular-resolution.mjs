/** Angular-acceleration resolution comparison; physical torque scale stays unknown. */
import { rolloutAngular } from './angular-discovery.mjs';
import { compareRolloutResolution } from './resolution.mjs';

export function rolloutAngularWithResolution(model, run, options = {}) {
  return compareRolloutResolution(rolloutAngular, model, run, options);
}
