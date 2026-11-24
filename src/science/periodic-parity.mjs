// A bounded identification experiment for u_t = D Δ_h u + G (S_half - I)u.
// Mode indices describe the experimenter's excitation, never a mechanism label.
import {requireState, validateStateTrajectory} from './state-trajectory.mjs';

const sum = values => values.reduce((a, b) => a + b, 0);

export function modeRow(mode, n, spacing) {
  requireState(Number.isInteger(n) && n >= 6 && n <= 128 && n % 2 === 0,
    'Require an even periodic grid of 6 to 128 sites');
  requireState(Number.isFinite(spacing) && spacing > 0, 'Require positive spacing');
  requireState(Number.isInteger(mode) && mode > 0 && mode < n / 2,
    'Use a positive resolved non-Nyquist Fourier mode');
  return [4 * Math.sin(Math.PI * mode / n) ** 2 / spacing ** 2, 2 * (mode % 2)];
}

function prepareModes(modes, n, spacing) {
  requireState(Array.isArray(modes) && modes.length > 0 && modes.length <= 8 &&
    new Set(modes).size === modes.length, 'Declare one to eight distinct probe modes');
  return modes.map(mode => {
    const row = modeRow(mode, n, spacing);
    const phase = Array.from({length:n}, (_, j) => 2 * Math.PI * mode * j / n);
    return {mode, row, cos:phase.map(Math.cos), sin:phase.map(Math.sin)};
  });
}

function project(state, basis) {
  let real = 0, imaginary = 0;
  for (let j = 0; j < state.length; j++) {
    real += state[j] * basis.cos[j];
    imaginary += state[j] * basis.sin[j];
  }
  return [2 * real / state.length, 2 * imaginary / state.length];
}

function amplitude(samples, rate, dt) {
  const rho = Math.exp(-rate * dt);
  let w = 1, weight = 0, re = 0, im = 0;
  for (const [r, i] of samples) {
    re += r * w; im += i * w; weight += w * w; w *= rho;
  }
  return [re / weight, im / weight];
}

// Eight disjoint equal-size block amplitudes are exchangeable under constant
// signal plus stationary IID measurement noise. The Mahonian inversion count
// is an exact one-sided order test in that null, with conservative tie refusal.
function decayOrderEvidence(samples) {
  const blocks=8, span=Math.floor(samples.length/blocks);
  const energy=Array.from({length:blocks},(_,k)=>{
    const sub=samples.slice(k*span,(k+1)*span);
    const re=sum(sub.map(x=>x[0]))/span, im=sum(sub.map(x=>x[1]))/span;
    return re*re+im*im;
  });
  if(new Set(energy).size!==blocks) return {p:1,blocks};
  let inversions=0, counts=[1];
  for(let i=0;i<blocks;i++){
    for(let j=0;j<i;j++) if(energy[i]>energy[j]) inversions++;
    const next=Array(counts.length+i).fill(0);
    for(let j=0;j<counts.length;j++)for(let extra=0;extra<=i;extra++)next[j+extra]+=counts[j];
    counts=next;
  }
  return {p:sum(counts.slice(0,inversions+1))/sum(counts),blocks,inversions};
}

function estimateDecay(samples, dt) {
  const duration = dt * (samples.length - 1);
  // Profile both unknown real quadratures at each decay. The finite grid bounds
  // the surrounding 1-D search; data that pick the unresolved fast edge refuse.
  const grid = [0, ...Array.from({length:65}, (_, i) => 2 ** (-10+i/4)/duration)];
  const objective = rate => {
    const [re, im] = amplitude(samples, rate, dt);
    const rho = Math.exp(-rate * dt);
    let w = 1, loss = 0;
    for (const [r, i] of samples) {
      loss += (r-re*w)**2 + (i-im*w)**2; w *= rho;
    }
    return loss;
  };
  const losses = grid.map(objective);
  const best = losses.indexOf(Math.min(...losses));
  if (best === grid.length - 1) return null;
  let lo = grid[Math.max(0,best-1)], hi = grid[best+1];
  for (let i=0; i<45; i++) {
    const a = (2*lo+hi)/3, b = (lo+2*hi)/3;
    if (objective(a) < objective(b)) hi=b; else lo=a;
  }
  const interior = (lo+hi)/2;
  return objective(0) <= objective(interior) ? 0 : interior;
}

function determinantRatio(rows) {
  const a=sum(rows.map(([x])=>x*x)), b=sum(rows.map(([x,y])=>x*y)),
    c=sum(rows.map(([,y])=>y*y));
  return a*c > 0 ? Math.max(0, 1-b*b/(a*c)) : 0;
}

export function chooseParityProbe(observedModes, menu, n, spacing) {
  requireState(Array.isArray(observedModes) && observedModes.length <= 24 &&
    Array.isArray(menu) && menu.length > 0 && menu.length <= 16, 'Invalid probe menu');
  const seen=observedModes.map(k=>modeRow(k,n,spacing));
  const designs=menu.map(modes=>{
    const added=prepareModes(modes,n,spacing).map(b=>b.row);
    return {modes:[...modes], normalizedGramDeterminant:determinantRatio([...seen,...added])};
  });
  const maximum=Math.max(...designs.map(d=>d.normalizedGramDeterminant));
  return {designs,selected:maximum>1e-10?designs.findIndex(d=>d.normalizedGramDeterminant===maximum):null};
}

export function fitParityDecay(recordings, declarations) {
  requireState(Array.isArray(recordings) && recordings.length>0 && recordings.length<=6 &&
    Array.isArray(declarations) && declarations.length===recordings.length, 'Require matching probe declarations');
  requireState(new Set(recordings.map(r=>r.id)).size===recordings.length, 'Duplicate recording identity');
  const fits=[];
  for (let i=0; i<recordings.length; i++) {
    const run=recordings[i], {n,dt}=validateStateTrajectory(run);
    requireState(run.kind==='periodic' && n===recordings[0].samples[0].state.length &&
      run.spacing===recordings[0].spacing, 'Probes must share the same periodic grid');
    requireState(run.samples.every(s=>s.command.every(x=>x===0)), 'Free-decay probes require zero command');
    for (const basis of prepareModes(declarations[i],n,run.spacing)) {
      const samples=run.samples.map(s=>project(s.state,basis));
      const evidence=decayOrderEvidence(samples);
      if(evidence.p>.01) return {status:'unresolved_decay_evidence',mode:basis.mode,evidence};
      const rate=estimateDecay(samples,dt);
      if (rate===null) return {status:'unresolved_decay_rate'};
      fits.push({mode:basis.mode,row:basis.row,rate,evidence});
    }
  }
  const a=sum(fits.map(z=>z.row[0]**2)), b=sum(fits.map(z=>z.row[0]*z.row[1])),
    c=sum(fits.map(z=>z.row[1]**2)), u=sum(fits.map(z=>z.rate*z.row[0])),
    w=sum(fits.map(z=>z.rate*z.row[1]));
  const local={diffusivity:u/a,halfShift:0};
  const identifiability=determinantRatio(fits.map(z=>z.row));
  if (identifiability<1e-10) return {status:'rank_deficient',local,identifiability,fits};
  const det=a*c-b*b;
  const interior={diffusivity:(c*u-b*w)/det,halfShift:(a*w-b*u)/det};
  // NNLS on a two-column linear decay-rate model. All feasible boundary points
  // that can minimize this convex loss are included.
  const choices=[local,{diffusivity:0,halfShift:w/c}];
  if(interior.diffusivity>=0 && interior.halfShift>=0) choices.push(interior);
  const error=m=>sum(fits.map(z=>(z.rate-z.row[0]*m.diffusivity-z.row[1]*m.halfShift)**2));
  const mixed=choices.reduce((best,m)=>error(m)<error(best)?m:best);
  return {status:'two_rates_resolved',local,mixed,identifiability,fits,
    scope:'Two declared linear periodic mechanisms. Design rank alone does not test model fit or certify a mechanism.'};
}

export function predictParityModes(model, prefix, times, spacing, modes) {
  requireState(model && [model.diffusivity,model.halfShift].every(v=>Number.isFinite(v)&&v>=0),
    'Require finite nonnegative decay parameters');
  requireState(Array.isArray(prefix)&&prefix.length>=2&&prefix.length<=64,'Require 2 to 64 prefix observations');
  const n=prefix[0]?.state?.length, dt=prefix[1]?.time-prefix[0]?.time;
  requireState(Number.isFinite(dt)&&dt>0 && prefix.every((r,i)=>Number.isFinite(r.time)&&
    Math.abs((r.time-prefix[0].time)-i*dt)<=1e-9*dt && Array.isArray(r.state)&&r.state.length===n&&
    r.state.every(Number.isFinite)&&Array.isArray(r.command)&&r.command.length===n&&
    r.command.every(x=>x===0)), 'Invalid free-decay prefix');
  requireState(Array.isArray(times)&&times.length>0&&times.length*n<=131072&&
    times.every((t,i)=>Number.isFinite(t)&&t>=prefix.at(-1).time&&(i===0||t>times[i-1])),
    'Forecast times must follow the observed prefix');
  const mean=sum(prefix.map(s=>sum(s.state)/n))/prefix.length;
  const components=prepareModes(modes,n,spacing).map(b=>{
    const rate=b.row[0]*model.diffusivity+b.row[1]*model.halfShift;
    const [real,imaginary]=amplitude(prefix.map(s=>project(s.state,b)),rate,dt);
    return {...b,rate,real,imaginary};
  });
  return times.map(t=>Array.from({length:n},(_,j)=>mean+sum(components.map(b=>
    Math.exp(-b.rate*(t-prefix[0].time))*(b.real*b.cos[j]+b.imaginary*b.sin[j])))));
}
