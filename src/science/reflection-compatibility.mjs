import {validateRows} from '../data.mjs';
import {rational, add, sub, mul, div, cmp, enclosure, serial} from '../unknown-lab/chronos-exact-halfplanes.mjs';

export const REFLECTION_SCHEMA = 'worldlaw.reflection-compatibility/v1';
const TWO = rational(2);
const coordinate = value => value === 0 ? 0 : value;
const intervalJSON = interval => ({lower:serial(interval.lower), upper:serial(interval.upper)});

/** Enumerate only exact command/rate slices already present in the original rows. */
export function reflectionSlices(observations) {
  const rows = validateRows(observations, {allowEmpty:true});
  const groups = new Map();
  rows.forEach((row, rowIndex) => {
    const command = coordinate(row.command), rate = coordinate(row.rate);
    const key = JSON.stringify([command, rate]);
    if (!groups.has(key)) groups.set(key, {command, rate, rowIndices:[], positions:new Map()});
    const group = groups.get(key), position = coordinate(row.position);
    group.rowIndices.push(rowIndex);
    group.positions.set(position, (group.positions.get(position) || 0) + 1);
  });
  return [...groups.values()].sort((a,b) => a.command-b.command || a.rate-b.rate).map(group => {
    let mirroredPairs = 0, unmatchedRows = 0;
    for (const [position, count] of group.positions) {
      if (position > 0 && group.positions.has(-position)) mirroredPairs++;
      if (position !== 0 && !group.positions.has(-position)) unmatchedRows += count;
    }
    return {command:group.command, rate:group.rate, rowIndices:group.rowIndices,
      positionCount:group.positions.size, mirroredPairs, zeroRows:group.positions.get(0) || 0, unmatchedRows};
  });
}

/** Outward display bounds only. Exact serialized rationals remain authoritative. */
export function reflectionDisplayBounds(value) {
  if (!value || typeof value.numerator !== 'string' || typeof value.denominator !== 'string' ||
      value.numerator.length > 1235 || value.denominator.length > 1234 ||
      !/^(?:0|-?[1-9]\d*)$/.test(value.numerator) || !/^[1-9]\d*$/.test(value.denominator)) {
    throw new Error('A bounded canonical exact rational is required for display.');
  }
  const exact = div([BigInt(value.numerator), BigInt(value.denominator)], [1n,1n]);
  const normalized = serial(exact);
  if (normalized.numerator !== value.numerator || normalized.denominator !== value.denominator) {
    throw new Error('Display bounds require a reduced canonical exact rational.');
  }
  return enclosure(exact);
}

/**
 * Challenge tau(theta)=c+g(theta), g(-theta)=-g(theta), about the declared zero.
 * No fitting, origin search, interpolation, implicit noise radius, or source mutation.
 * All interval decisions use exact arithmetic on admitted binary64 inputs.
 */
export function analyzeReflectionCompatibility(observations, declaration = {}) {
  const rows = validateRows(observations, {allowEmpty:true});
  if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) {
    throw new Error('Reflection assumptions must be an explicit declaration object.');
  }
  const missing = [];
  for (const field of ['command','rate','absoluteTorqueError']) {
    const value = declaration[field];
    if (value === undefined) { missing.push(field); continue; }
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e6 ||
        (field === 'absoluteTorqueError' && value < 0)) {
      throw new Error(field === 'absoluteTorqueError'
        ? 'Declare a finite absolute torque error between 0 and 1,000,000 N·m.'
        : `Declare a finite ${field} coordinate between −1,000,000 and 1,000,000.`);
    }
  }
  if (declaration.exactCoordinates !== true) missing.push('exactCoordinates');
  const declared = {
    command:declaration.command === undefined ? null : coordinate(declaration.command),
    rate:declaration.rate === undefined ? null : coordinate(declaration.rate),
    absoluteTorqueError:declaration.absoluteTorqueError === undefined ? null : coordinate(declaration.absoluteTorqueError),
    exactCoordinates:declaration.exactCoordinates === true,
    angleOrigin:0,
  };
  const selectedRowIndices = [];
  if (declared.command !== null && declared.rate !== null) rows.forEach((row,index) => {
    if (row.command === declared.command && row.rate === declared.rate) selectedRowIndices.push(index);
  });
  const base = {schema:REFLECTION_SCHEMA, declaration:declared, sourceRowCount:rows.length, selectedRowIndices};
  if (missing.length) return {...base, status:'declaration-required', missing};

  const radius = rational(declared.absoluteTorqueError), byPosition = new Map();
  for (const rowIndex of selectedRowIndices) {
    const row = rows[rowIndex], position = coordinate(row.position);
    if (!byPosition.has(position)) byPosition.set(position, {position, rowIndices:[], readings:[]});
    const state = byPosition.get(position), observed = rational(row.jointTorque);
    state.rowIndices.push(rowIndex);
    state.readings.push({rowIndex, observedTorque:row.jointTorque,
      lower:sub(observed,radius), upper:add(observed,radius)});
  }
  const states = [...byPosition.values()].sort((a,b) => a.position-b.position);
  const positionIndex = new Map(states.map((state,index) => [state.position,index]));
  let repeatConflict = null;
  states.forEach((state,stateIndex) => {
    let lowerReading = state.readings[0], upperReading = state.readings[0];
    for (const reading of state.readings) {
      if (cmp(reading.lower,lowerReading.lower) > 0) lowerReading = reading;
      if (cmp(reading.upper,upperReading.upper) < 0) upperReading = reading;
    }
    state.interval = {lower:lowerReading.lower, upper:upperReading.upper};
    state.lowerRowIndex = lowerReading.rowIndex;
    state.upperRowIndex = upperReading.rowIndex;
    if (!repeatConflict && cmp(state.interval.lower,state.interval.upper) > 0) {
      repeatConflict = {kind:'repeat-conflict', stateIndex,
        lowerRowIndex:state.lowerRowIndex, upperRowIndex:state.upperRowIndex,
        gap:serial(sub(state.interval.lower,state.interval.upper))};
    }
  });
  const pairs = [], unmatchedStateIndices = [];
  let pairedRows = 0;
  states.forEach((state,index) => {
    if (state.position > 0 && positionIndex.has(-state.position)) {
      const negative = positionIndex.get(-state.position);
      pairs.push([negative,index]);
      pairedRows += states[negative].rowIndices.length + state.rowIndices.length;
    }
    if (state.position !== 0 && !positionIndex.has(-state.position)) unmatchedStateIndices.push(index);
  });
  const zeroIndex = positionIndex.get(0);
  const coverage = {selectedRows:selectedRowIndices.length, states:states.length,
    mirroredPairs:pairs.length, pairedRows,
    zeroRows:zeroIndex === undefined ? 0 : states[zeroIndex].rowIndices.length,
    unmatchedRows:unmatchedStateIndices.reduce((sum,index) => sum+states[index].rowIndices.length,0)};
  const output = {...base, states:states.map(state => ({position:state.position,
    rowIndices:state.rowIndices, readingBounds:state.readings.map(reading => ({
      rowIndex:reading.rowIndex, observedTorque:reading.observedTorque,
      lower:serial(reading.lower), upper:serial(reading.upper)})),
    interval:intervalJSON(state.interval), lowerRowIndex:state.lowerRowIndex, upperRowIndex:state.upperRowIndex})),
    coverage, unmatchedStateIndices};
  if (repeatConflict) return {...output, status:'repeat-conflict', constraints:[], commonOffset:null, certificate:repeatConflict};

  const constraints = pairs.map(([negative,positive],index) => ({
    id:`pair-${index}`, kind:'pair', magnitude:states[positive].position,
    stateIndices:[negative,positive],
    rowIndices:[...states[negative].rowIndices,...states[positive].rowIndices].sort((a,b) => a-b),
    interval:{lower:div(add(states[negative].interval.lower,states[positive].interval.lower),TWO),
      upper:div(add(states[negative].interval.upper,states[positive].interval.upper),TWO)},
  }));
  if (zeroIndex !== undefined) constraints.push({id:'zero', kind:'zero', stateIndices:[zeroIndex],
    rowIndices:[...states[zeroIndex].rowIndices], interval:states[zeroIndex].interval});
  let lowerConstraint = constraints[0], upperConstraint = constraints[0];
  for (const constraint of constraints) {
    if (cmp(constraint.interval.lower,lowerConstraint.interval.lower) > 0) lowerConstraint = constraint;
    if (cmp(constraint.interval.upper,upperConstraint.interval.upper) < 0) upperConstraint = constraint;
  }
  const common = constraints.length ? {lower:lowerConstraint.interval.lower, upper:upperConstraint.interval.upper} : null;
  output.constraints = constraints.map(constraint => ({...constraint, interval:intervalJSON(constraint.interval)}));
  output.commonOffset = common ? intervalJSON(common) : null;
  if (!pairs.length) return {...output, status:'insufficient',
    reason:selectedRowIndices.length ? 'no-mirrored-pairs' : 'no-selected-rows', certificate:null};
  if (cmp(common.lower,common.upper) > 0) return {...output, status:'excluded',
    certificate:{kind:'offset-exclusion', lowerConstraintId:lowerConstraint.id,
      upperConstraintId:upperConstraint.id, gap:serial(sub(common.lower,common.upper))}};

  const offset = common.lower, twiceOffset = mul(offset,TWO);
  const stateTorques = states.map(state => state.interval.lower);
  for (const [negative,positive] of pairs) {
    const inferredLower = sub(twiceOffset,states[negative].interval.upper);
    const positiveTorque = cmp(states[positive].interval.lower,inferredLower) >= 0
      ? states[positive].interval.lower : inferredLower;
    stateTorques[positive] = positiveTorque;
    stateTorques[negative] = sub(twiceOffset,positiveTorque);
  }
  if (zeroIndex !== undefined) stateTorques[zeroIndex] = offset;
  return {...output, status:'compatible', certificate:{kind:'finite-witness', offset:serial(offset),
    stateTorques:stateTorques.map((torque,stateIndex) => ({stateIndex,torque:serial(torque)}))}};
}
