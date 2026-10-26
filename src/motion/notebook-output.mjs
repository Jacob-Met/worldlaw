import {validateNotebook} from './measurement.mjs';

/** Match the existing Motion notebook reader's byte limit. */
export const MAX_MOTION_NOTEBOOK_FILE_BYTES = 8 * 1024 * 1024;
const encoder = new TextEncoder();

/**
 * Exact saved snapshot text, also used when identifying a retained notebook.
 * Formatting may change; every validated source field remains in the output.
 */
export function serializeMotionNotebook(input) {
  const notebook = validateNotebook(input);
  const readable = JSON.stringify(notebook, null, 2) + '\n';
  if (encoder.encode(readable).byteLength <= MAX_MOTION_NOTEBOOK_FILE_BYTES) return readable;

  const compact = JSON.stringify(notebook) + '\n';
  if (encoder.encode(compact).byteLength > MAX_MOTION_NOTEBOOK_FILE_BYTES) {
    throw new Error('The complete Motion notebook exceeds the 8 MB file limit even without indentation.');
  }
  return compact;
}
