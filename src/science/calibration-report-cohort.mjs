import{calibrationReportGroup}from'./calibration-report.mjs';
export function calibrationReportCohortGroup(report,training,indices,association,id){
 if(!Array.isArray(training)||!training.length||training.length>4096||!Array.isArray(indices)||!indices.length||indices.length>training.length||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0||i>=training.length))throw Error('Select complete unique original training row indices.');
 if(typeof id!=='string'||!id.trim()||id.length>120)throw Error('Name this original report cohort.');
 const group=calibrationReportGroup(report,indices.length,association);
 return{...group,id,rows:[...indices],referenceReport:{...group.referenceReport,trainingRows:indices.map(index=>({index,row:structuredClone(training[index])}))}};
}
export function validateReportCohort(group,training){
 const rows=group.referenceReport?.trainingRows;if(rows===undefined){if(group.rows?.length!==training.length)throw Error('Received report association must retain every original training row.');return;}
 if(!Array.isArray(rows)||rows.length!==group.rows?.length||rows.some((r,j)=>r?.index!==group.rows[j]||!Number.isInteger(r.index)||r.index<0||r.index>=training.length||JSON.stringify(r.row)!==JSON.stringify(training[r.index])))throw Error('Retain the exact original row values and indices for every report cohort.');
}
