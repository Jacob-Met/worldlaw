/** Count the maintained output grid without a duplicate rounded endpoint.
 * Callers validate positive finite duration/dt and enforce their work limits.
 * Compare actual emitted multiplication, never an epsilon that erases a
 * genuinely later representable final time.
 */
export function outputIntervalCount(duration, dt) {
  const count = Math.ceil(duration / dt);
  return count > 1 && (count - 1) * dt >= duration ? count - 1 : count;
}

