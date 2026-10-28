// Independent analytic controls for tests/release-separation.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {compareNearbyReleases} from '../src/science/release-separation.mjs';
export function registerNearbyReleaseTests({compareNearbyReleases,makeModel}) {
  const close=(a,b,tol=2e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} differs from ${b}`);
  const run=(weights,delta,options={},initial={position:0,rate:0})=>compareNearbyReleases(makeModel(weights),initial,delta,{duration:1,dt:0.02,...options});
  const completed=r=>{
    assert.equal(r.status,'completed');
    assert.equal(r.comparisons.full.status,'completed');
    assert.equal(r.comparisons.half.status,'completed');
    assert.equal(r.sizeComparison.status,'completed');
    assert.equal(r.sizeComparison.exactHalfInitialDifference,true);
    return r;
  };
  const end=r=>r.comparisons.full.rows.at(-1);
  const equalFactors=r=>{for(const row of r.sizeComparison.rows)close(row.factorDifference,0);};

  test('independent free-particle shear has finite growth with zero instantaneous eigenvalues',()=>{
    const r=completed(run({bias:0},{position:0,rate:0.25},{timeScale:1}));
    for(const row of r.comparisons.full.rows){
      close(row.positionDifference,0.25*row.time,1e-12);
      close(row.rateDifference,0.25,1e-12);
      close(row.responseFactor,Math.hypot(1,row.time),1e-12);
    }
    close(end(r).responseFactor,Math.SQRT2,1e-12);
    equalFactors(r);
  });
  test('independent critically damped solution matches displacement and velocity',()=>{
    const r=completed(run({spring:-1,rate:-2},{position:0.5,rate:0},{timeScale:2}));
    for(const row of r.comparisons.full.rows){
      const t=row.time,e=Math.exp(-t);
      close(row.positionDifference,0.5*(1+t)*e);
      close(row.rateDifference,-0.5*t*e);
      close(row.responseFactor,e*Math.hypot(1+t,2*t));
    }
    equalFactors(r);
  });
  test('independent oscillator preserves the correctly weighted norm',()=>{
    const r=completed(run({spring:-4},{position:0.5,rate:0},{timeScale:0.5}));
    for(const row of r.comparisons.full.rows){
      close(row.positionDifference,0.5*Math.cos(2*row.time));
      close(row.rateDifference,-Math.sin(2*row.time));
      close(row.responseFactor,1);
    }
    equalFactors(r);
  });
  test('independent unstable spring follows its growing eigenvector',()=>{
    const r=completed(run({spring:1},{position:0.25,rate:0.25},{timeScale:3}));
    for(const row of r.comparisons.full.rows){
      close(row.positionDifference,0.25*Math.exp(row.time));
      close(row.rateDifference,0.25*Math.exp(row.time));
      close(row.responseFactor,Math.exp(row.time));
    }
    equalFactors(r);
  });
  test('independent time scale changes only reported norm, not solver courses',()=>{
    const a=completed(run({bias:0},{position:0,rate:0.25},{timeScale:0.5}));
    const b=completed(run({bias:0},{position:0,rate:0.25},{timeScale:2}));
    assert.deepEqual(a.courses,b.courses);
    close(end(a).responseFactor,Math.sqrt(5),1e-12);
    close(end(b).responseFactor,Math.sqrt(1.25),1e-12);
    close(a.comparisons.full.initialDistance,0.125,1e-12);
    close(b.comparisons.full.initialDistance,0.5,1e-12);
  });
  test('independent decaying selected direction can miss an unstable mode',()=>{
    const r=completed(run({spring:1},{position:0.25,rate:-0.25},{timeScale:3}));
    for(const row of r.comparisons.full.rows){
      close(row.positionDifference,0.25*Math.exp(-row.time));
      close(row.rateDifference,-0.25*Math.exp(-row.time));
      close(row.responseFactor,Math.exp(-row.time));
    }
    equalFactors(r);
    // This same spring law has the growing (+position,+rate) direction above.
    assert.ok(end(r).responseFactor<1);
  });
  test('independent Coulomb release retains fixed execution away from zero rate',()=>{
    const r=completed(run({coulomb:-0.5},{position:0.25,rate:0},
      {duration:1,dt:0.02},{position:0,rate:2}));
    for(const course of Object.values(r.courses)){
      assert.equal(course.diagnostics.method,'classical_RK4');
      assert.equal(course.diagnostics.globalErrorBound,null);
      assert.equal(course.diagnostics.rejectedSteps,0);
      assert.equal(course.diagnostics.acceptedSteps,50);
      assert.equal(course.diagnostics.trials,undefined);
      for(const row of course.trajectory){
        close(row.position,course.initial.position+2*row.time-0.25*row.time**2);
        close(row.rate,2-0.5*row.time);
        assert.ok(row.rate>0);
      }
    }
    for(const row of r.comparisons.full.rows){
      close(row.positionDifference,0.25);
      close(row.rateDifference,0);
      close(row.responseFactor,1);
    }
    equalFactors(r);
    assert.equal(r.work.completedAdaptiveTrials,0);
    assert.equal(r.work.failedCourseWorkUnknown,false);
    assert.equal(r.work.reservedMaximumFixedSteps,150);
  });
  test('independent nonlinear cubic law shows finite amplitude dependence',()=>{
    const t=0.05;
    const r=completed(run({cubic:1},{position:1,rate:0},{duration:t,dt:0.005,timeScale:1}));
    const full=end(r).responseFactor,half=r.comparisons.half.rows.at(-1).responseFactor;
    assert.ok(full>half);
    // Short-time series predicts difference 27 t^2 / 32 + O(t^4).
    // A 2% relative envelope accommodates that retained higher-order remainder.
    const leading=27*t*t/32;
    assert.ok(Math.abs((full-half)/leading-1)<0.02);
    assert.equal(r.sizeComparison.rows.at(-1).factorDifference,full-half);
  });
  test('independent actual rounded initial differences are retained',()=>{
    const initial={position:2**19,rate:0},ulp=2**-33;
    // Requested 3 ulps and 1.5 ulps become actual 3 and 2 ulps.
    const r=run({bias:0},{position:3*ulp,rate:0},{duration:0.1,dt:0.1},initial);
    assert.equal(r.status,'completed');
    assert.equal(r.initialPerturbations.full.actual.position,3*ulp);
    assert.equal(r.initialPerturbations.half.actual.position,2*ulp);
    assert.equal(r.sizeComparison.exactHalfInitialDifference,false);
    assert.equal(r.comparisons.full.initialDistance,3*ulp);
    assert.equal(r.comparisons.half.initialDistance,2*ulp);
    close(r.comparisons.full.rows[0].responseFactor,1,1e-12);
    close(r.comparisons.half.rows[0].responseFactor,1,1e-12);
  });
  test('independent half perturbation rounding away is explicitly refused',()=>{
    assert.throws(()=>run({bias:0},{position:2**-33,rate:0},{},{position:2**19,rate:0}),
      error=>error.code==='unresolved_numeric' && /rounds away/.test(error.message));
  });
  test('independent exhausted solver budget cannot become combined success',()=>{
    const r=run({spring:-1},{position:0.5,rate:0},{duration:0.2,dt:0.1,maxTrials:1});
    assert.equal(r.status,'incomplete');
    for(const course of Object.values(r.courses)){
      assert.equal(course.status,'failed');
      assert.equal(course.code,'step_limit');
      assert.equal(course.partialTrajectoryAvailable,false);
      assert.equal(course.executedDuration,null);
    }
    assert.equal(r.comparisons.full.status,'unavailable');
    assert.equal(r.comparisons.half.status,'unavailable');
    assert.equal(r.sizeComparison.status,'unavailable');
    assert.equal(r.work.failedCourseWorkUnknown,true);
  });
  test('independent boundary failure retains the other completed courses',()=>{
    const r=run({bias:0},{position:1,rate:0},
      {duration:0.2,dt:0.1,maxTrials:20},{position:999999,rate:1});
    assert.equal(r.status,'incomplete');
    assert.equal(r.courses.nominal.status,'completed');
    assert.equal(r.courses.half.status,'completed');
    assert.equal(r.courses.full.status,'failed');
    assert.ok(typeof r.courses.full.code==='string' && r.courses.full.code.length>0);
    assert.ok(typeof r.courses.full.reason==='string' && r.courses.full.reason.length>0);
    assert.equal(r.courses.full.partialTrajectoryAvailable,false);
    assert.equal(r.courses.full.executedDuration,null);
    assert.equal(r.comparisons.full.status,'unavailable');
    assert.equal(r.comparisons.half.status,'completed');
    assert.equal(r.sizeComparison.status,'unavailable');
    assert.equal(r.work.failedCourseWorkUnknown,true);
    close(r.courses.nominal.executedDuration,0.2,1e-12);
    close(r.courses.half.executedDuration,0.2,1e-12);
    // Surviving half release differs only by constant position under zero torque.
    close(r.comparisons.half.rows.at(-1).responseFactor,1,1e-12);
  });
  test('independent selected-direction result makes no convergence or maximum-gain claim',()=>{
    const r=completed(run({bias:0},{position:0,rate:0.25}));
    assert.match(r.interpretation,/not maximum gain/);
    assert.match(r.interpretation,/physical validation/);
    assert.match(r.sizeComparison.interpretation,/not a variational derivative/);
    assert.match(r.sizeComparison.interpretation,/numerical convergence test/);
    assert.match(r.sizeComparison.interpretation,/integration-error bound/);
    // Free-particle maximum gain at t/tau=1 is golden ratio, not this direction's sqrt(2).
    assert.ok(Math.abs(end(r).responseFactor-(1+Math.sqrt(5))/2)>0.1);
    assert.equal(r.norm.distanceUnit,'rad');
    assert.equal(r.norm.responseFactorUnit,'1');
  });
}

const makeModel=coefficients=>({
  schema:'worldlaw.torque-model/v1',
  terms:Object.entries(coefficients).map(([id,coefficient])=>({id,coefficient})),
});
registerNearbyReleaseTests({compareNearbyReleases,makeModel});
