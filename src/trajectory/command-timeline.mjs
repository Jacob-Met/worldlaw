/** Declared delayed zero-order-held commands, on the original elapsed clock.
 * This module never interpolates, shifts, or manufactures angle observations.
 */
export class CommandTimingError extends Error {
  constructor(message, code = 'invalid_command_timing') { super(message); this.name = 'CommandTimingError'; this.code = code; }
}
const insist = (condition, message) => { if (!condition) throw new CommandTimingError(message); };

export function normalizeCommandTiming(raw = {}) {
  insist(raw !== null && typeof raw === 'object' && !Array.isArray(raw), 'Command timing must be an object.');
  const delaySeconds = raw.delaySeconds ?? 0;
  insist(typeof delaySeconds === 'number' && Number.isFinite(delaySeconds) && delaySeconds >= 0 && delaySeconds <= 30,
    'Command delay must be a finite number from 0 to 30 seconds.');
  const beforeStart = raw.beforeStart;
  if (delaySeconds > 0 || beforeStart !== undefined) insist(typeof beforeStart === 'number' && Number.isFinite(beforeStart) && Math.abs(beforeStart) <= 1e6,
    'A positive delay requires an explicit constant command before the recording, in N·m (magnitude at most 1,000,000).');
  return { delaySeconds, ...(beforeStart !== undefined ? { beforeStart } : {}) };
}

/** Piecewise constant intervals, partitioned at source observations AND delayed events. */
export function prepareCommandTimeline(samples, rawTiming = {}) {
  const timing = normalizeCommandTiming(rawTiming);
  insist(Array.isArray(samples) && samples.length >= 2 && samples.length <= 10000, 'Command timing needs 2–10000 source samples.');
  const origin = samples[0]?.time;
  insist(typeof origin === 'number' && Number.isFinite(origin), 'The command clock must be finite.');
  const times = samples.map((row, index) => {
    insist(row !== null && typeof row === 'object' && typeof row.time === 'number' && Number.isFinite(row.time) &&
      typeof row.command === 'number' && Number.isFinite(row.command) && Math.abs(row.command) <= 1e6,
      `Command sample ${index + 1} needs finite time and command.`);
    if (index) insist(row.time > samples[index - 1].time, 'The command clock must strictly increase.');
    const elapsed = row.time - origin;
    insist(Number.isFinite(elapsed) && (!index || elapsed > samples[index - 1].time - origin), 'Elapsed command times must remain distinct and finite.');
    return elapsed;
  });
  const duration = times.at(-1);
  // The final recorded command is outside the recorded integration interval.
  const events = [];
  let command = timing.delaySeconds > 0 ? timing.beforeStart : samples[0].command;
  let previousCommand = command;
  for (let i = 0; i < samples.length - 1; i++) {
    const at = times[i] + timing.delaySeconds;
    if (at >= duration) break;
    if (samples[i].command === previousCommand) continue;
    insist(Number.isFinite(at) && (!events.length || at > events.at(-1).at), 'Delayed command changes must have distinct representable times.');
    events.push({ at, command: samples[i].command, sourceIndex: i });
    previousCommand = samples[i].command;
  }
  const intervals = [], commandsAtSamples = [], doubleIntegrals = [0];
  let eventIndex = 0, firstIntegral = 0, secondIntegral = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    let cursor = times[i];
    while (eventIndex < events.length && events[eventIndex].at <= cursor) command = events[eventIndex++].command;
    commandsAtSamples.push(command);
    const segments = [];
    while (cursor < times[i + 1]) {
      const end = eventIndex < events.length ? Math.min(times[i + 1], events[eventIndex].at) : times[i + 1];
      const h = end - cursor;
      insist(h > 0 && Number.isFinite(h), 'A delayed command interval cannot be represented.');
      segments.push({ start: cursor, end, duration: h, command });
      secondIntegral += h * firstIntegral + h * h * command / 2;
      firstIntegral += h * command;
      cursor = end;
      if (eventIndex < events.length && events[eventIndex].at <= cursor) command = events[eventIndex++].command;
    }
    insist(Number.isFinite(firstIntegral) && Number.isFinite(secondIntegral), 'Integrated command exceeds numerical range.');
    intervals.push(segments); doubleIntegrals.push(secondIntegral);
  }
  commandsAtSamples.push(command);
  return { timing, origin, times, events, intervals, commandsAtSamples, doubleIntegrals,
    convention: 'recorded command is held left; applied command at t is recorded command at t − delay; constant declared prehistory',
    observationGridUnchanged: true };
}
