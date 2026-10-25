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
  const responseTimeSeconds = raw.responseTimeSeconds ?? 0;
  insist(typeof responseTimeSeconds === 'number' && Number.isFinite(responseTimeSeconds) && responseTimeSeconds >= 0 && responseTimeSeconds <= 30,
    'Command response time must be a finite number from 0 to 30 seconds.');
  const beforeStart = raw.beforeStart;
  if (delaySeconds > 0 || responseTimeSeconds > 0 || beforeStart !== undefined) insist(typeof beforeStart === 'number' && Number.isFinite(beforeStart) && Math.abs(beforeStart) <= 1e6,
    'A delayed or gradual response requires an explicit constant command before the recording, in N·m (magnitude at most 1,000,000).');
  return { delaySeconds, ...(beforeStart !== undefined ? { beforeStart } : {}), ...(raw.responseTimeSeconds !== undefined ? {responseTimeSeconds} : {}) };
}

/** Exact exponential input moments, with a cancellation-safe small h/tau limit. */
export function commandResponseMoments(start, target, duration, responseTimeSeconds) {
  const h = duration, tau = responseTimeSeconds;
  insist([start,target,h,tau].every(Number.isFinite) && h >= 0 && tau > 0, 'Finite input and a positive response time are required.');
  if (h === 0) return {end:start,first:0,second:0};
  const x=h/tau, change=-Math.expm1(-x), delta=target-start;
  const end=x<.5?start+delta*change:target-delta*Math.exp(-x);
  let first,second;
  if(x<.05){
    // Integrate the change from the initial command, avoiding target-minus-target
    // cancellation when a short interval starts at zero applied input.
    const firstStep=x*(.5+x*(-1/6+x*(1/24+x*(-1/120+x*(1/720+x*(-1/5040+x*(1/40320-x/362880)))))));
    const secondStep=x*(1/6+x*(-1/24+x*(1/120+x*(-1/720+x*(1/5040+x*(-1/40320+x*(1/362880-x/3628800)))))));
    first=start*h+delta*h*firstStep;
    second=start*h*h/2+delta*h*h*secondStep;
  }else{
    // Integrate the deviation from the target; this also retains a decaying
    // impulse when h/tau is large and the final target is zero.
    first=target*h+(start-target)*tau*change;
    second=target*h*h/2+(start-target)*tau*(h-tau*change);
  }
  insist([end,first,second].every(Number.isFinite), 'Filtered command moments exceed numerical range.');
  return {end,first,second};
}

/** Analytic applied input inside one timeline segment; never an angle observation. */
export function commandAtSegment(segment, elapsed) {
  if (!(segment.responseTimeSeconds > 0)) return segment.command;
  const t=Math.max(0,Math.min(segment.duration,elapsed));
  const x=t/segment.responseTimeSeconds,delta=segment.command-segment.responseStart;
  return x<.5?segment.responseStart+delta*(-Math.expm1(-x)):segment.command-delta*Math.exp(-x);
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
  const responseTimeSeconds=timing.responseTimeSeconds??0;
  let applied=timing.beforeStart;
  let eventIndex = 0, firstIntegral = 0, secondIntegral = 0;
  for (let i = 0; i < samples.length - 1; i++) {
    let cursor = times[i];
    while (eventIndex < events.length && events[eventIndex].at <= cursor) command = events[eventIndex++].command;
    commandsAtSamples.push(responseTimeSeconds>0?applied:command);
    const segments = [];
    while (cursor < times[i + 1]) {
      const end = eventIndex < events.length ? Math.min(times[i + 1], events[eventIndex].at) : times[i + 1];
      const h = end - cursor;
      insist(h > 0 && Number.isFinite(h), 'A delayed command interval cannot be represented.');
      const segment={ start: cursor, end, duration: h, command };
      if(responseTimeSeconds>0){
        segment.responseStart=applied;segment.responseTimeSeconds=responseTimeSeconds;
        const moment=commandResponseMoments(applied,command,h,responseTimeSeconds);
        secondIntegral+=h*firstIntegral+moment.second;firstIntegral+=moment.first;applied=moment.end;
      }else{
        secondIntegral += h * firstIntegral + h * h * command / 2;
        firstIntegral += h * command;
      }
      segments.push(segment);
      cursor = end;
      if (eventIndex < events.length && events[eventIndex].at <= cursor) command = events[eventIndex++].command;
    }
    insist(Number.isFinite(firstIntegral) && Number.isFinite(secondIntegral), 'Integrated command exceeds numerical range.');
    intervals.push(segments); doubleIntegrals.push(secondIntegral);
  }
  commandsAtSamples.push(responseTimeSeconds>0?applied:command);
  return { timing, origin, times, events, intervals, commandsAtSamples, doubleIntegrals,
    convention: responseTimeSeconds>0?'responseTime × appliedCommand′ + appliedCommand = delayed held command; declared prehistory is the initial equilibrium':'recorded command is held left; applied command at t is recorded command at t − delay; constant declared prehistory',
    terminalCommandConvention:'left_limit_at_final_observation; a terminal-only command change does not enter the recorded integration interval',
    observationGridUnchanged: true };
}
