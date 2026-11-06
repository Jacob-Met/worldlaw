import { registerHooks } from 'node:module';
const panelURL = 'file:///dev/shm/b93164ce-worldlaw-local-comparison-ui-01/source/src/science/local-motion-comparison-panel.mjs';
const coreURL = 'file:///dev/shm/b93164ce-worldlaw-local-comparison-01/source/src/science/local-motion-comparison.mjs';
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './local-motion-comparison.mjs' && context.parentURL === panelURL) {
      return nextResolve(coreURL, context);
    }
    return nextResolve(specifier, context);
  },
});
